from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from worklens_agent.config import AgentConfig
from worklens_agent.runtime import RuntimePaths


@dataclass(frozen=True)
class EnrollmentValues:
    api_url: str
    device_id: str
    agent_token: str


def save_verified_enrollment(
    config_path: Path,
    values: EnrollmentValues,
    verify: Callable[[AgentConfig], bool],
) -> bool:
    if not values.api_url.strip().lower().startswith("https://"):
        raise ValueError("The hosted WorkLens API URL must use HTTPS.")
    config = AgentConfig._from_values(
        api_url=values.api_url,
        device_id=values.device_id,
        agent_token=values.agent_token,
        agent_version="0.1.0",
        idle_threshold_seconds=300,
        excluded_processes="",
    )
    if not verify(config):
        return False
    config.write_runtime_file(config_path)
    return True


def _verify_with_heartbeat(config: AgentConfig, database_path: Path) -> bool:
    from worklens_agent.client import AgentClient
    from worklens_agent.queue import ActivityQueue

    queue = ActivityQueue(database_path)
    client = AgentClient(config, queue)
    try:
        return client.send_heartbeat()
    finally:
        client.close()
        queue.close()


def enroll(paths: RuntimePaths, default_api_url: str = "") -> bool:
    import tkinter as tk
    from tkinter import ttk

    window = tk.Tk()
    window.title("Enroll WorkLens Agent")
    window.resizable(False, False)
    frame = ttk.Frame(window, padding=20)
    frame.grid()

    api_url = tk.StringVar(value=default_api_url)
    device_id = tk.StringVar()
    agent_token = tk.StringVar()
    message = tk.StringVar(
        value=(
            "Enter the hosted WorkLens URL and the credentials issued by your "
            "manager."
        )
    )
    completed = {"value": False}

    fields = [
        ("Hosted API URL", api_url, False),
        ("Device ID", device_id, False),
        ("Device token", agent_token, True),
    ]
    for row, (label, value, is_secret) in enumerate(fields):
        ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=(0, 4))
        ttk.Entry(
            frame, textvariable=value, width=54, show="*" if is_secret else ""
        ).grid(
            row=row, column=1, sticky="ew", pady=(0, 8)
        )

    ttk.Label(frame, textvariable=message, foreground="#8b0000", wraplength=440).grid(
        row=3, column=0, columnspan=2, sticky="w", pady=(0, 12)
    )

    def submit() -> None:
        try:
            saved = save_verified_enrollment(
                paths.config_path,
                EnrollmentValues(api_url.get(), device_id.get(), agent_token.get()),
                lambda config: _verify_with_heartbeat(config, paths.database_path),
            )
        except ValueError as error:
            message.set(str(error))
            return
        if not saved:
            message.set(
                "WorkLens could not authenticate. Check the URL and credentials."
            )
            return
        completed["value"] = True
        window.destroy()

    buttons = ttk.Frame(frame)
    buttons.grid(row=4, column=0, columnspan=2, sticky="e")
    ttk.Button(buttons, text="Cancel", command=window.destroy).grid(
        row=0, column=0, padx=(0, 8)
    )
    ttk.Button(buttons, text="Enroll", command=submit).grid(row=0, column=1)
    window.protocol("WM_DELETE_WINDOW", window.destroy)
    window.mainloop()
    return completed["value"]
