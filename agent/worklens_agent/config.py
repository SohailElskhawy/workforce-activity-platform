from dataclasses import dataclass
import os

from dotenv import load_dotenv


@dataclass(frozen=True)
class AgentConfig:
    api_url: str
    device_id: str
    agent_token: str
    agent_version: str
    idle_threshold_seconds: int
    excluded_processes: frozenset[str]

    @classmethod
    def from_environment(cls) -> "AgentConfig":
        load_dotenv()
        api_url = os.environ.get("WORKLENS_API_URL", "").rstrip("/")
        device_id = os.environ.get("WORKLENS_DEVICE_ID", "")
        agent_token = os.environ.get("WORKLENS_AGENT_TOKEN", "")
        if not api_url or not device_id or not agent_token:
            raise ValueError(
                "WORKLENS_API_URL, WORKLENS_DEVICE_ID, and WORKLENS_AGENT_TOKEN are required."
            )
        excluded = frozenset(
            process.strip().lower()
            for process in os.environ.get("WORKLENS_EXCLUDED_PROCESSES", "").split(",")
            if process.strip()
        )
        return cls(
            api_url=api_url,
            device_id=device_id,
            agent_token=agent_token,
            agent_version=os.environ.get("WORKLENS_AGENT_VERSION", "0.1.0"),
            idle_threshold_seconds=int(
                os.environ.get("WORKLENS_IDLE_THRESHOLD_SECONDS", "300")
            ),
            excluded_processes=excluded,
        )
