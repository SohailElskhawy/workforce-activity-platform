import logging
from datetime import datetime, timezone
from typing import Protocol

import httpx

from worklens_agent.config import AgentConfig
from worklens_agent.queue import ActivityQueue


logger = logging.getLogger(__name__)


class HttpClient(Protocol):
    def post(self, url: str, **kwargs: object) -> httpx.Response: ...
    def get(self, url: str, **kwargs: object) -> httpx.Response: ...


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
        self._connection_status = "Connected"
        self._last_server_config_version: int | None = None

    @property
    def config(self) -> AgentConfig:
        return self._config

    @property
    def connection_status(self) -> str:
        return self._connection_status

    @property
    def last_server_config_version(self) -> int | None:
        return self._last_server_config_version

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.agent_token}",
            "X-Device-ID": self._config.device_id,
            "Content-Type": "application/json",
        }

    def update_config(self, config: AgentConfig) -> None:
        self._config = config

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
            self._connection_status = "Offline / retrying"
            return False
        if response.status_code == 401:
            logger.warning(
                "Device authentication failed (HTTP 401). Device may have been revoked by manager or token is invalid."
            )
            self._connection_status = "Authentication rejected"
            return False
        if not response.is_success:
            logger.warning("Activity upload returned HTTP %s", response.status_code)
            self._connection_status = "Offline / retrying"
            return False
        self._connection_status = "Connected"
        self._queue.mark_uploaded([item.event_id for item in pending])
        return True

    def send_heartbeat(self) -> int | None:
        """Sends heartbeat. Returns the server configVersion on success (>= 1), or None on failure."""
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
            self._connection_status = "Offline / retrying"
            return None
        if response.status_code == 401:
            logger.warning(
                "Heartbeat rejected: device authentication failed (HTTP 401). Device may have been revoked."
            )
            self._connection_status = "Authentication rejected"
            return None
        if not response.is_success:
            logger.warning("Heartbeat returned HTTP %s", response.status_code)
            self._connection_status = "Offline / retrying"
            return None

        self._connection_status = "Connected"
        server_version = 1
        if hasattr(response, "json"):
            try:
                data = response.json()
                payload = (
                    data.get("data")
                    if isinstance(data, dict) and "data" in data
                    else data
                )
                if isinstance(payload, dict) and "configVersion" in payload:
                    server_version = int(payload["configVersion"])
            except Exception:
                server_version = 1
        self._last_server_config_version = server_version
        return server_version

    def fetch_tracking_config(self) -> dict[str, object] | None:
        """Fetches the latest company tracking settings and exclusions."""
        try:
            response = self._http_client.get(
                f"{self._config.api_url.rstrip('/')}/api/agent/config",
                headers=self.headers,
            )
        except httpx.RequestError as error:
            logger.warning("Tracking config fetch failed: %s", error)
            self._connection_status = "Offline / retrying"
            return None
        except Exception as error:
            logger.warning("Unexpected error during tracking config fetch: %s", error)
            return None

        if response.status_code == 401:
            logger.warning("Tracking config rejected: device authentication failed (HTTP 401).")
            self._connection_status = "Authentication rejected"
            return None
        if not response.is_success:
            logger.warning("Tracking config returned HTTP %s", response.status_code)
            return None

        if not hasattr(response, "json"):
            return None

        try:
            data = response.json()
            payload = (
                data.get("data")
                if isinstance(data, dict) and "data" in data
                else data
            )
            if isinstance(payload, dict):
                return {
                    "configVersion": int(payload.get("configVersion", 1)),
                    "idleThresholdSeconds": int(payload.get("idleThresholdSeconds", 300)),
                    "excludedProcesses": list(payload.get("excludedProcesses", [])),
                }
        except Exception as error:
            logger.warning("Failed to parse tracking config response: %s", error)
        return None

    def close(self) -> None:
        if self._owns_client:
            self._http_client.close()  # type: ignore[attr-defined]
