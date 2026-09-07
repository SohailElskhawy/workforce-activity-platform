from dataclasses import dataclass, field
import logging
import sys
import threading
from typing import Callable
import webbrowser

logger = logging.getLogger(__name__)


@dataclass
class AgentState:
    connection_status: str = "Connected"
    current_app: str = "—"
    current_project: str = "—"
    current_task: str = "—"
    active_seconds_today: int = 0
    idle_seconds_today: int = 0
    agent_version: str = "1.0.0"
    config_version: int = 1
    api_url: str = ""
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def update(
        self,
        *,
        connection_status: str | None = None,
        current_app: str | None = None,
        current_project: str | None = None,
        current_task: str | None = None,
        active_seconds_delta: int = 0,
        idle_seconds_delta: int = 0,
        config_version: int | None = None,
    ) -> None:
        with self._lock:
            if connection_status is not None:
                self.connection_status = connection_status
            if current_app is not None:
                self.current_app = current_app
            if current_project is not None:
                self.current_project = current_project
            if current_task is not None:
                self.current_task = current_task
            if active_seconds_delta > 0:
                self.active_seconds_today += active_seconds_delta
            if idle_seconds_delta > 0:
                self.idle_seconds_today += idle_seconds_delta
            if config_version is not None:
                self.config_version = config_version

    def format_today_active(self) -> str:
        with self._lock:
            sec = self.active_seconds_today
        hours = sec // 3600
        mins = (sec % 3600) // 60
        return f"{hours}h {mins}m"

    def format_today_idle(self) -> str:
        with self._lock:
            sec = self.idle_seconds_today
        hours = sec // 3600
        mins = (sec % 3600) // 60
        return f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

    def get_status_summary(self) -> str:
        with self._lock:
            return (
                f"WorkLens Agent v{self.agent_version}\n"
                f"Status: {self.connection_status}\n\n"
                f"Current Application: {self.current_app}\n"
                f"Project: {self.current_project}\n"
                f"Task: {self.current_task}\n\n"
                f"Today Active: {self.format_today_active()}\n"
                f"Today Idle: {self.format_today_idle()}\n"
                f"Config Version: v{self.config_version}"
            )


# Command IDs for the tray menu
ID_TITLE = 1001
ID_STATUS = 1002
ID_APP = 1003
ID_PROJECT = 1004
ID_TASK = 1005
ID_TODAY = 1006
ID_OPEN_PORTAL = 1007
ID_STATUS_DETAILS = 1008
ID_VERSION = 1009
ID_EXIT = 1010


class SystemTray:
    def __init__(
        self,
        state: AgentState,
        on_exit: Callable[[], None] | None = None,
    ) -> None:
        self.state = state
        self.on_exit = on_exit
        self._hwnd = None
        self._thread: threading.Thread | None = None
        self._started = threading.Event()
        self._running = False

    def start(self) -> bool:
        if sys.platform != "win32":
            logger.info("System tray is only supported on Windows.")
            return False

        try:
            self._thread = threading.Thread(
                target=self._run_message_loop,
                name="WorkLensSystemTray",
                daemon=True,
            )
            self._thread.start()
            self._started.wait(timeout=3.0)
            return self._running
        except Exception as error:
            logger.warning("Failed to start system tray thread: %s", error)
            return False

    def stop(self) -> None:
        if not self._running or sys.platform != "win32":
            return
        self._running = False
        try:
            import win32con
            import win32gui

            if self._hwnd:
                nid = (self._hwnd, 0)
                win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, nid)
                win32gui.PostMessage(self._hwnd, win32con.WM_CLOSE, 0, 0)
        except Exception as error:
            logger.debug("Error while closing system tray: %s", error)

    def _run_message_loop(self) -> None:
        try:
            import win32con
            import win32gui

            class_name = f"WorkLensTrayClass_{id(self)}"
            wc = win32gui.WNDCLASS()
            wc.lpszClassName = class_name
            wc.lpfnWndProc = self._wnd_proc
            wc.hInstance = win32gui.GetModuleHandle(None)
            win32gui.RegisterClass(wc)

            self._hwnd = win32gui.CreateWindow(
                class_name,
                "WorkLens Tray Window",
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                wc.hInstance,
                None,
            )

            hicon = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)
            nid = (
                self._hwnd,
                0,
                win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP,
                win32con.WM_USER + 20,
                hicon,
                "WorkLens Activity Agent",
            )
            win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)
            self._running = True
            self._started.set()

            win32gui.PumpMessages()
        except Exception as error:
            logger.warning("System tray initialization failed: %s", error)
            self._running = False
            self._started.set()

    def _wnd_proc(self, hwnd: int, msg: int, wparam: int, lparam: int) -> int:
        import win32con
        import win32gui

        if msg == win32con.WM_USER + 20:
            # Tray icon interaction: right-click or left-click brings up the menu
            if lparam in (win32con.WM_RBUTTONUP, win32con.WM_LBUTTONUP):
                self._show_menu(hwnd)
            return 0
        elif msg == win32con.WM_COMMAND:
            cmd = wparam & 0xFFFF
            if cmd == ID_OPEN_PORTAL:
                target_url = self.state.api_url or "http://localhost:3000"
                webbrowser.open(target_url)
            elif cmd == ID_STATUS_DETAILS:
                win32gui.MessageBox(
                    hwnd,
                    self.state.get_status_summary(),
                    "WorkLens Agent Status",
                    win32con.MB_OK | win32con.MB_ICONINFORMATION,
                )
            elif cmd == ID_EXIT:
                self.stop()
                if self.on_exit:
                    self.on_exit()
            return 0
        elif msg == win32con.WM_DESTROY:
            win32gui.PostQuitMessage(0)
            return 0

        return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)

    def _show_menu(self, hwnd: int) -> None:
        import win32con
        import win32gui

        menu = win32gui.CreatePopupMenu()
        try:
            # Status icon & text
            status_indicator = (
                "●" if self.state.connection_status == "Connected" else "○"
            )

            # Header
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_TITLE,
                "WorkLens",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_STATUS,
                f"{status_indicator} {self.state.connection_status}",
            )
            win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")

            # Current state
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_APP,
                f"Current: {self.state.current_app}",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_PROJECT,
                f"Project: {self.state.current_project}",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_TASK,
                f"Task: {self.state.current_task}",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_TODAY,
                f"Today: {self.state.format_today_active()} active | {self.state.format_today_idle()} idle",
            )
            win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")

            # Actions
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING,
                ID_OPEN_PORTAL,
                "Open WorkLens",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING,
                ID_STATUS_DETAILS,
                "View Status Details...",
            )
            win32gui.AppendMenu(
                menu,
                win32con.MF_STRING | win32con.MF_GRAYED,
                ID_VERSION,
                f"Version {self.state.agent_version} (v{self.state.config_version})",
            )
            win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
            win32gui.AppendMenu(menu, win32con.MF_STRING, ID_EXIT, "Exit")

            pos = win32gui.GetCursorPos()
            win32gui.SetForegroundWindow(hwnd)
            win32gui.TrackPopupMenu(
                menu,
                win32con.TPM_LEFTALIGN | win32con.TPM_RIGHTBUTTON,
                pos[0],
                pos[1],
                0,
                hwnd,
                None,
            )
            win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)
        finally:
            win32gui.DestroyMenu(menu)
