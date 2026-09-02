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


if __name__ == "__main__":
    unittest.main()
