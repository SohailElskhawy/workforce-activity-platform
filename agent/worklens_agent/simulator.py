from datetime import datetime, timedelta, timezone
from typing import Iterator

from worklens_agent.models import Observation


class SimulatorCollector:
    def __init__(self, start_at: datetime | None = None, step_seconds: int = 5) -> None:
        self.start_at = start_at or datetime.now(timezone.utc)
        self.step_seconds = step_seconds

    def observations(self) -> Iterator[Observation]:
        states = [
            ("APPLICATION", "AutoCAD", "acad.exe", "Autodesk AutoCAD - ABC_A_Block.dwg", "ABC_A_Block.dwg"),
            ("APPLICATION", "Chrome", "chrome.exe", "WorkLens dashboard", None),
            ("APPLICATION", "AutoCAD", "acad.exe", "Autodesk AutoCAD - ABC_B_Block.dwg", "ABC_B_Block.dwg"),
            ("IDLE", None, None, None, None),
            ("APPLICATION", "Excel", "excel.exe", "Project estimate.xlsx", None),
        ]
        for index, (kind, application_name, process_name, window_title, file_name) in enumerate(states):
            yield Observation(
                at=self.start_at + timedelta(seconds=index * self.step_seconds),
                kind=kind,
                application_name=application_name,
                process_name=process_name,
                window_title=window_title,
                file_name=file_name,
            )
