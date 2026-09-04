from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Mapping

from dotenv import load_dotenv

from worklens_agent.security import protect_secret, unprotect_secret


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
        return cls._from_values(
            api_url=os.environ.get("WORKLENS_API_URL", ""),
            device_id=os.environ.get("WORKLENS_DEVICE_ID", ""),
            agent_token=os.environ.get("WORKLENS_AGENT_TOKEN", ""),
            agent_version=os.environ.get("WORKLENS_AGENT_VERSION", "0.1.0"),
            idle_threshold_seconds=os.environ.get(
                "WORKLENS_IDLE_THRESHOLD_SECONDS", "300"
            ),
            excluded_processes=os.environ.get("WORKLENS_EXCLUDED_PROCESSES", ""),
        )

    @classmethod
    def from_runtime_file(
        cls, path: Path, default_api_url: str = ""
    ) -> "AgentConfig":
        try:
            values = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            values = {}
        except (json.JSONDecodeError, OSError) as error:
            raise ValueError("WorkLens runtime configuration is invalid.") from error
        if not isinstance(values, Mapping):
            raise ValueError("WorkLens runtime configuration is invalid.")

        should_migrate = False
        encrypted_token = values.get("agentTokenEncrypted")
        if encrypted_token and isinstance(encrypted_token, str):
            try:
                agent_token = unprotect_secret(encrypted_token)
            except Exception as error:
                raise ValueError("WorkLens secure token could not be decrypted.") from error
        elif "agentToken" in values and isinstance(values["agentToken"], str) and values["agentToken"]:
            # Legacy plaintext token detected -> load and mark for secure migration
            agent_token = values["agentToken"]
            should_migrate = True
        else:
            agent_token = ""

        config = cls._from_values(
            api_url=values.get("apiUrl", default_api_url),
            device_id=values.get("deviceId", ""),
            agent_token=agent_token,
            agent_version=values.get("agentVersion", "0.1.0"),
            idle_threshold_seconds=values.get("idleThresholdSeconds", "300"),
            excluded_processes=values.get("excludedProcesses", ""),
        )

        if should_migrate:
            # Overwrite file with encrypted token to eliminate plaintext on disk
            config.write_runtime_file(path)

        return config

    def write_runtime_file(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = path.with_suffix(f"{path.suffix}.tmp")
        encrypted_token = protect_secret(self.agent_token)
        temporary_path.write_text(
            json.dumps(
                {
                    "apiUrl": self.api_url,
                    "deviceId": self.device_id,
                    "agentTokenEncrypted": encrypted_token,
                    "agentVersion": self.agent_version,
                    "idleThresholdSeconds": self.idle_threshold_seconds,
                    "excludedProcesses": sorted(self.excluded_processes),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        temporary_path.replace(path)

    @classmethod
    def _from_values(
        cls,
        *,
        api_url: object,
        device_id: object,
        agent_token: object,
        agent_version: object,
        idle_threshold_seconds: object,
        excluded_processes: object,
    ) -> "AgentConfig":
        api_url = api_url.rstrip("/") if isinstance(api_url, str) else ""
        device_id = device_id if isinstance(device_id, str) else ""
        agent_token = agent_token if isinstance(agent_token, str) else ""
        if not api_url or not device_id or not agent_token:
            raise ValueError(
                "WORKLENS_API_URL, WORKLENS_DEVICE_ID, and "
                "WORKLENS_AGENT_TOKEN are required."
            )
        excluded_values = (
            excluded_processes
            if isinstance(excluded_processes, list)
            else str(excluded_processes).split(",")
        )
        excluded = frozenset(
            process.strip().lower()
            for process in excluded_values
            if process.strip()
        )
        return cls(
            api_url=api_url,
            device_id=device_id,
            agent_token=agent_token,
            agent_version=agent_version if isinstance(agent_version, str) else "0.1.0",
            idle_threshold_seconds=int(idle_threshold_seconds),
            excluded_processes=excluded,
        )
