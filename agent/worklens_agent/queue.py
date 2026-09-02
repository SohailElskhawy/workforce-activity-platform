from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3

from worklens_agent.models import ActivitySegment


@dataclass(frozen=True)
class QueuedActivity:
    event_id: str
    payload: dict[str, str | None]


class ActivityQueue:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path)
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS pending_activity (
              event_id TEXT PRIMARY KEY,
              payload_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              uploaded_at TEXT NULL
            )
            """
        )
        self._connection.commit()

    def enqueue(self, segment: ActivitySegment) -> None:
        self._connection.execute(
            "INSERT OR IGNORE INTO pending_activity (event_id, payload_json, created_at) VALUES (?, ?, ?)",
            (
                segment.event_id,
                json.dumps(segment.to_payload()),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self._connection.commit()

    def pending(self, limit: int = 100) -> list[QueuedActivity]:
        capped_limit = min(max(limit, 0), 100)
        rows = self._connection.execute(
            "SELECT event_id, payload_json FROM pending_activity WHERE uploaded_at IS NULL ORDER BY created_at ASC, rowid ASC LIMIT ?",
            (capped_limit,),
        ).fetchall()
        return [
            QueuedActivity(event_id=row[0], payload=json.loads(row[1])) for row in rows
        ]

    def mark_uploaded(self, event_ids: list[str]) -> None:
        if not event_ids:
            return
        uploaded_at = datetime.now(timezone.utc).isoformat()
        self._connection.executemany(
            "UPDATE pending_activity SET uploaded_at = ? WHERE event_id = ?",
            [(uploaded_at, event_id) for event_id in event_ids],
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()
