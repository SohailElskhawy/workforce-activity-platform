import logging
from datetime import datetime, timezone
from typing import Protocol

import httpx

from worklens_agent.config import AgentConfig
from worklens_agent.queue import ActivityQueue


logger = logging.getLogger(__name__)


class HttpClient(Protocol):
    def post(self, url: str, **kwargs: object) -> httpx.Response: ...


class AgentClient:
    def __init__(
        self,
        config: AgentConfig,
        queue: ActivityQueue,
        http_client: HttpClient | None = None,
    ) -> None:
        self._config = config
        self._queue = queue
        self._http_client = http_client or httpx.Client(timeout=10.0)
        self._owns_client = http_client is None

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.agent_token}",
            "X-Device-ID": self._config.device_id,
            "Content-Type": "application/json",
        }

    def upload_pending(self) -> bool:
        pending = self._queue.pending()
        if not pending:
            return True
        try:
            response = self._http_client.post(
                f"{self._config.api_url.rstrip('/')}/api/agent/activities/batch",
                headers=self.headers,
                json={"activities": [item.payload for item in pending]},
            )
        except httpx.RequestError as error:
            logger.warning("Activity upload failed: %s", error)
            return False
        if not response.is_success:
            logger.warning("Activity upload returned HTTP %s", response.status_code)
            return False
        self._queue.mark_uploaded([item.event_id for item in pending])
        return True

    def send_heartbeat(self) -> bool:
        try:
            response = self._http_client.post(
                f"{self._config.api_url.rstrip('/')}/api/agent/heartbeat",
                headers=self.headers,
                json={
                    "agentVersion": self._config.agent_version,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        except httpx.RequestError as error:
            logger.warning("Heartbeat failed: %s", error)
            return False
        if not response.is_success:
            logger.warning("Heartbeat returned HTTP %s", response.status_code)
            return False
        return True

    def close(self) -> None:
        if self._owns_client:
            self._http_client.close()  # type: ignore[attr-defined]
