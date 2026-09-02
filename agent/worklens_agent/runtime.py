from dataclasses import dataclass
import json
import logging
import os
from pathlib import Path
import sys
from typing import Mapping


@dataclass(frozen=True)
class RuntimePaths:
    root: Path

    @property
    def config_path(self) -> Path:
        return self.root / "config.json"

    @property
    def database_path(self) -> Path:
        return self.root / "activity.db"

    @property
    def log_path(self) -> Path:
        return self.root / "logs" / "agent.log"

    @classmethod
    def for_current_user(
        cls, environment: Mapping[str, str] | None = None
    ) -> "RuntimePaths":
        env = os.environ if environment is None else environment
        local_app_data = env.get("LOCALAPPDATA")
        if local_app_data:
            return cls(Path(local_app_data) / "WorkLens")
        return cls(Path.home() / ".local" / "share" / "WorkLens")


def load_packaged_default_api_url() -> str:
    resource_root = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    if getattr(sys, "frozen", False):
        defaults_path = resource_root / "worklens_agent" / "runtime-defaults.json"
    else:
        defaults_path = resource_root / "runtime-defaults.json"
    try:
        payload = json.loads(defaults_path.read_text(encoding="utf-8-sig"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return ""
    api_url = payload.get("apiUrl", "")
    return api_url.rstrip("/") if isinstance(api_url, str) else ""


def configure_file_logging(log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    resolved_path = log_path.resolve()
    for handler in root_logger.handlers:
        if (
            isinstance(handler, logging.FileHandler)
            and Path(handler.baseFilename) == resolved_path
        ):
            return
    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    root_logger.addHandler(handler)
