from datetime import datetime, timedelta, timezone
from pathlib import Path
from io import StringIO
import sys
import tempfile
import unittest
from unittest.mock import patch

from worklens_agent.main import main, process_observations
from worklens_agent.models import Observation
from worklens_agent.queue import ActivityQueue
from worklens_agent.segmenter import SegmentBuilder


class MainLoopTests(unittest.TestCase):
    def test_process_observations_persists_closed_segments_and_flushes_on_shutdown(
        self,
    ) -> None:
        start_at = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
        observations = [
            Observation(
                start_at,
                "APPLICATION",
                "AutoCAD",
                "acad.exe",
                "ABC_A_Block.dwg",
                "ABC_A_Block.dwg",
            ),
            Observation(
                start_at + timedelta(seconds=5), "IDLE", None, None, None, None
            ),
        ]
        with tempfile.TemporaryDirectory() as tempdir:
            queue = ActivityQueue(Path(tempdir) / "activity.db")
            process_observations(
                observations,
                SegmentBuilder(),
                queue,
                finish_at=start_at + timedelta(seconds=10),
            )
            pending = queue.pending()
            queue.close()

        self.assertEqual(
            [item.payload["type"] for item in pending], ["APPLICATION", "IDLE"]
        )
        self.assertEqual(
            [item.payload["endAt"] for item in pending],
            [
                (start_at + timedelta(seconds=5)).isoformat(),
                (start_at + timedelta(seconds=10)).isoformat(),
            ],
        )

    def test_real_mode_reports_the_windows_requirement_before_loading_agent_credentials(
        self,
    ) -> None:
        stderr = StringIO()
        with patch.object(sys, "platform", "linux"), patch("sys.stderr", stderr):
            with self.assertRaises(SystemExit) as exit_error:
                main(["--mode", "real"])

        self.assertEqual(exit_error.exception.code, 2)
        self.assertIn(
            "Real collector requires Windows. Use --mode simulate on this machine.",
            stderr.getvalue(),
        )


if __name__ == "__main__":
    unittest.main()
