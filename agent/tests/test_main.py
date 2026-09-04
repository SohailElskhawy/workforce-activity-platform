from datetime import datetime, timedelta, timezone
from pathlib import Path
from io import StringIO
import sys
import tempfile
import unittest
from unittest.mock import patch

import worklens_agent.main as main_module
from worklens_agent.config import AgentConfig
from worklens_agent.main import main, process_observations
from worklens_agent.models import Observation
from worklens_agent.queue import ActivityQueue
from worklens_agent.runtime import close_file_logging
from worklens_agent.segmenter import SegmentBuilder


class MainLoopTests(unittest.TestCase):
    def test_packaged_runtime_directory_starts_real_mode_with_persisted_config(
        self,
    ) -> None:
        config = AgentConfig(
            api_url="https://host.example",
            device_id="PC-1",
            agent_token="issued-token",
            agent_version="0.1.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            runtime_dir = Path(tempdir)
            config.write_runtime_file(runtime_dir / "config.json")
            with (
                patch.object(sys, "platform", "win32"),
                patch.object(main_module, "is_packaged", return_value=True),
                patch.object(main_module, "run_real") as run_real,
            ):
                try:
                    self.assertEqual(main(["--runtime-dir", str(runtime_dir)]), 0)
                finally:
                    close_file_logging(runtime_dir / "logs" / "agent.log")

        run_real.assert_called_once_with(config, runtime_dir / "activity.db")

    def test_developer_simulator_mode_still_uses_environment_config(self) -> None:
        config = AgentConfig(
            api_url="https://host.example",
            device_id="PC-1",
            agent_token="issued-token",
            agent_version="0.1.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )
        with (
            patch.object(
                main_module.AgentConfig, "from_environment", return_value=config
            ) as from_environment,
            patch.object(main_module, "run_simulator") as run_simulator,
        ):
            self.assertEqual(main(["--mode", "simulate"]), 0)

        from_environment.assert_called_once()
        run_simulator.assert_called_once()

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

    def test_status_command_reports_operational_status(self) -> None:
        config = AgentConfig(
            api_url="https://host.example",
            device_id="PC-STATUS-TEST",
            agent_token="issued-token",
            agent_version="1.0.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            runtime_dir = Path(tempdir)
            config.write_runtime_file(runtime_dir / "config.json")
            stdout = StringIO()
            with (
                patch("sys.stdout", stdout),
                patch("worklens_agent.client.AgentClient.send_heartbeat", return_value=True),
            ):
                code = main(["--status", "--runtime-dir", str(runtime_dir)])
            self.assertEqual(code, 0)
            output = stdout.getvalue()
            self.assertIn("PC-STATUS-TEST", output)
            self.assertIn("CONNECTED (Online)", output)


if __name__ == "__main__":
    unittest.main()
