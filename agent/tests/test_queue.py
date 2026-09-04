from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

from worklens_agent.models import ActivitySegment
from worklens_agent.queue import ActivityQueue


def segment(number: int) -> ActivitySegment:
    start_at = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc) + timedelta(
        seconds=number * 10
    )
    return ActivitySegment(
        event_id=f"event-{number:03d}",
        start_at=start_at,
        end_at=start_at + timedelta(seconds=10),
        type="APPLICATION",
        application_name="AutoCAD",
        process_name="acad.exe",
        window_title="ABC_A_Block.dwg",
        file_name="ABC_A_Block.dwg",
    )


class ActivityQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.path = Path(self.tempdir.name) / "activity.db"

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def test_enqueue_survives_reopening_the_database(self) -> None:
        queue = ActivityQueue(self.path)
        queue.enqueue(segment(1))
        queue.close()

        reopened = ActivityQueue(self.path)
        self.assertEqual([item.event_id for item in reopened.pending()], ["event-001"])
        self.assertEqual(reopened.pending()[0].payload["fileName"], "ABC_A_Block.dwg")
        reopened.close()

    def test_pending_returns_unsent_rows_oldest_first(self) -> None:
        queue = ActivityQueue(self.path)
        queue.enqueue(segment(3))
        queue.enqueue(segment(1))
        queue.enqueue(segment(2))

        self.assertEqual(
            [item.event_id for item in queue.pending()],
            ["event-003", "event-001", "event-002"],
        )
        queue.close()

    def test_mark_uploaded_removes_only_acknowledged_rows_from_pending(self) -> None:
        queue = ActivityQueue(self.path)
        queue.enqueue(segment(1))
        queue.enqueue(segment(2))

        queue.mark_uploaded(["event-001"])
        self.assertEqual([item.event_id for item in queue.pending()], ["event-002"])
        queue.close()

    def test_pending_limits_a_batch_to_one_hundred_rows(self) -> None:
        queue = ActivityQueue(self.path)
        for number in range(101):
            queue.enqueue(segment(number))

        self.assertEqual(len(queue.pending()), 100)
        self.assertEqual(len(queue.pending(limit=10)), 10)
        queue.close()

    def test_prune_uploaded_removes_old_rows_and_preserves_pending_and_recent(self) -> None:
        queue = ActivityQueue(self.path)
        # 1. Enqueue 4 segments
        queue.enqueue(segment(1))  # will be old uploaded
        queue.enqueue(segment(2))  # will be recent uploaded
        queue.enqueue(segment(3))  # pending (recent)
        queue.enqueue(segment(4))  # pending (old)

        now = datetime.now(timezone.utc)
        old_time = (now - timedelta(days=10)).isoformat()
        recent_time = (now - timedelta(days=2)).isoformat()

        # Mark event-001 uploaded 10 days ago (older than 7-day retention)
        # Mark event-002 uploaded 2 days ago (within retention)
        # Leave event-003 and event-004 as pending (uploaded_at is NULL)
        queue._connection.execute(
            "UPDATE pending_activity SET uploaded_at = ? WHERE event_id = ?",
            (old_time, "event-001"),
        )
        queue._connection.execute(
            "UPDATE pending_activity SET uploaded_at = ? WHERE event_id = ?",
            (recent_time, "event-002"),
        )
        # Simulate event-004 created a month ago but still unuploaded
        queue._connection.execute(
            "UPDATE pending_activity SET created_at = ? WHERE event_id = ?",
            ((now - timedelta(days=30)).isoformat(), "event-004"),
        )
        queue._connection.commit()

        # Prune with 7-day retention
        pruned = queue.prune_uploaded(retention_days=7)
        self.assertEqual(pruned, 1)

        # Check raw rows in the table
        rows = dict(
            queue._connection.execute(
                "SELECT event_id, uploaded_at FROM pending_activity"
            ).fetchall()
        )
        # Old uploaded row was removed
        self.assertNotIn("event-001", rows)
        # Recent uploaded row was preserved
        self.assertIn("event-002", rows)
        # Pending rows were preserved unconditionally
        self.assertIn("event-003", rows)
        self.assertIn("event-004", rows)

        # Pending query still returns both pending items
        pending_ids = [item.event_id for item in queue.pending()]
        self.assertIn("event-003", pending_ids)
        self.assertIn("event-004", pending_ids)
        queue.close()

        # Database remains completely valid after reopening
        reopened = ActivityQueue(self.path)
        reopened_ids = [item.event_id for item in reopened.pending()]
        self.assertIn("event-003", reopened_ids)
        self.assertIn("event-004", reopened_ids)
        reopened.close()


if __name__ == "__main__":
    unittest.main()
