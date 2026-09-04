from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import time

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
        self._connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_pending_activity_uploaded
            ON pending_activity (uploaded_at)
            """
        )
        self._connection.commit()
        self._last_prune_time = time.monotonic()
        # Perform startup pruning of old uploaded records
        self.prune_uploaded()

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

        # Periodically prune uploaded rows without excessive execution (every 1 hour)
        now = time.monotonic()
        if now - self._last_prune_time >= 3600:
            self.prune_uploaded()
            self._last_prune_time = now

    def prune_uploaded(
        self, retention_days: int = 7, cutoff: datetime | None = None
    ) -> int:
        """Prune successfully uploaded rows older than the retention window.
        Pending/unuploaded rows (uploaded_at IS NULL) are NEVER deleted.
        """
        if cutoff is None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_iso = cutoff.isoformat()
        cursor = self._connection.execute(
            "DELETE FROM pending_activity WHERE uploaded_at IS NOT NULL AND uploaded_at < ?",
            (cutoff_iso,),
        )
        deleted_count = cursor.rowcount
        if deleted_count > 0:
            self._connection.commit()
        return deleted_count

    def close(self) -> None:
        self._connection.close()

