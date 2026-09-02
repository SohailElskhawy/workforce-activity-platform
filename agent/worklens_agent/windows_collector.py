import ctypes
from datetime import datetime, timezone
from pathlib import PureWindowsPath
import sys

from worklens_agent.autocad import extract_dwg_filename
from worklens_agent.config import AgentConfig
from worklens_agent.models import Observation


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


class WindowsCollector:
    def __init__(self, config: AgentConfig) -> None:
        if sys.platform != "win32":
            raise RuntimeError(
                "Real collector requires Windows. Use --mode simulate on this machine."
            )
        import psutil
        import win32gui
        import win32process

        self._config = config
        self._psutil = psutil
        self._win32gui = win32gui
        self._win32process = win32process

    def observe(self) -> Observation:
        observed_at = datetime.now(timezone.utc)
        if self._idle_seconds() >= self._config.idle_threshold_seconds:
            return Observation(observed_at, "IDLE", None, None, None, None)

        window_handle = self._win32gui.GetForegroundWindow()
        if not window_handle:
            return Observation(observed_at, "SKIP", None, None, None, None)
        try:
            _, process_id = self._win32process.GetWindowThreadProcessId(window_handle)
            process_name = self._psutil.Process(process_id).name()
            window_title = self._win32gui.GetWindowText(window_handle) or None
        except (
            self._psutil.AccessDenied,
            self._psutil.NoSuchProcess,
            self._psutil.ZombieProcess,
            OSError,
        ):
            return Observation(observed_at, "SKIP", None, None, None, None)

        normalized_process = process_name.casefold()
        if normalized_process in self._config.excluded_processes:
            return Observation(observed_at, "SKIP", None, None, None, None)

        application_name = PureWindowsPath(process_name).stem
        file_name = (
            extract_dwg_filename(window_title) if "acad" in normalized_process else None
        )
        return Observation(
            observed_at,
            "APPLICATION",
            application_name,
            process_name,
            window_title,
            file_name,
        )

    @staticmethod
    def _idle_seconds() -> float:
        last_input = LASTINPUTINFO()
        last_input.cbSize = ctypes.sizeof(LASTINPUTINFO)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(last_input)):
            return 0.0
        current_tick = ctypes.windll.kernel32.GetTickCount()
        return ((current_tick - last_input.dwTime) & 0xFFFFFFFF) / 1_000
