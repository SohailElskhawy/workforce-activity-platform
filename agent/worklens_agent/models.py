from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import uuid4


ObservationKind = Literal["APPLICATION", "IDLE", "SKIP"]
ActivityType = Literal["APPLICATION", "IDLE"]


@dataclass(frozen=True)
class Observation:
    at: datetime
    kind: ObservationKind
    application_name: str | None
    process_name: str | None
    window_title: str | None
    file_name: str | None


@dataclass(frozen=True)
class ActivitySegment:
    start_at: datetime
    end_at: datetime
    type: ActivityType
    application_name: str | None
    process_name: str | None
    window_title: str | None
    file_name: str | None
    event_id: str = field(default_factory=lambda: str(uuid4()))

    @property
    def duration_seconds(self) -> int:
        return int((self.end_at - self.start_at).total_seconds())

    def to_payload(self) -> dict[str, str | None]:
        return {
            "eventId": self.event_id,
            "startAt": self.start_at.isoformat(),
            "endAt": self.end_at.isoformat(),
            "type": self.type,
            "applicationName": self.application_name,
            "processName": self.process_name,
            "windowTitle": self.window_title,
            "fileName": self.file_name,
        }
