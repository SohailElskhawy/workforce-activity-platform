import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from worklens_agent.client import AgentClient
from worklens_agent.config import AgentConfig
from worklens_agent.queue import ActivityQueue
from worklens_agent.segmenter import SegmentBuilder
from worklens_agent.windows_collector import WindowsCollector


class TrackingSyncAndPrivacyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.queue_path = Path(self.temp_dir.name) / "activity.db"
        self.queue = ActivityQueue(self.queue_path)
        self.config = AgentConfig(
            api_url="https://api.worklens.test",
            device_id="DEV-001",
            agent_token="token-abc",
            agent_version="1.0.0",
            config_version=1,
            idle_threshold_seconds=300,
            excluded_processes=frozenset({"whatsapp.exe", "slack.exe"}),
        )

    def tearDown(self) -> None:
        self.queue.close()
        self.temp_dir.cleanup()

    def test_heartbeat_same_version_does_not_trigger_fetch(self) -> None:
        mock_http = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "status": "ok",
            "deviceStatus": "ONLINE",
            "serverTime": "2026-09-06T12:00:00.000Z",
            "configVersion": 1,
        }
        mock_http.post.return_value = mock_response

        client = AgentClient(self.config, self.queue, http_client=mock_http)
        version = client.send_heartbeat()
        self.assertEqual(version, 1)
        mock_http.get.assert_not_called()

    def test_heartbeat_version_bump_fetches_and_applies_new_config(self) -> None:
        mock_http = MagicMock()
        hb_resp = MagicMock()
        hb_resp.status_code = 200
        hb_resp.is_success = True
        hb_resp.json.return_value = {
            "status": "ok",
            "deviceStatus": "ONLINE",
            "serverTime": "2026-09-06T12:00:00.000Z",
            "configVersion": 2,
        }
        mock_http.post.return_value = hb_resp

        cfg_resp = MagicMock()
        cfg_resp.status_code = 200
        cfg_resp.is_success = True
        cfg_resp.json.return_value = {
            "configVersion": 2,
            "idleThresholdSeconds": 600,
            "excludedProcesses": ["whatsapp.exe", "signal.exe", "keepass.exe"],
        }
        mock_http.get.return_value = cfg_resp

        client = AgentClient(self.config, self.queue, http_client=mock_http)
        hb_version = client.send_heartbeat()
        self.assertEqual(hb_version, 2)

        fetched = client.fetch_tracking_config()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["configVersion"], 2)
        self.assertEqual(fetched["idleThresholdSeconds"], 600)
        self.assertIn("keepass.exe", fetched["excludedProcesses"])

        updated_config = self.config.with_tracking_settings(
            config_version=fetched["configVersion"],
            idle_threshold_seconds=fetched["idleThresholdSeconds"],
            excluded_processes=fetched["excludedProcesses"],
        )
        client.update_config(updated_config)
        self.assertEqual(client.config.config_version, 2)
        self.assertEqual(client.config.idle_threshold_seconds, 600)
        self.assertEqual(
            client.config.excluded_processes,
            frozenset({"whatsapp.exe", "signal.exe", "keepass.exe"}),
        )

    def test_failed_config_fetch_preserves_last_known_config(self) -> None:
        mock_http = MagicMock()
        mock_http.get.side_effect = httpx.RequestError("Network unreachable")

        client = AgentClient(self.config, self.queue, http_client=mock_http)
        fetched = client.fetch_tracking_config()
        self.assertIsNone(fetched)
        self.assertEqual(client.config.config_version, 1)
        self.assertEqual(client.config.idle_threshold_seconds, 300)

    def test_windows_collector_lock_unlock_transitions(self) -> None:
        collector = WindowsCollector(self.config)
        collector._idle_seconds = lambda: 0.0
        collector._win32gui = MagicMock()
        collector._win32gui.GetForegroundWindow.return_value = 101
        collector._win32gui.GetWindowText.return_value = "Untitled - Notepad"
        collector._win32process = MagicMock()
        collector._win32process.GetWindowThreadProcessId.return_value = (0, 1234)
        mock_proc = MagicMock()
        mock_proc.name.return_value = "notepad.exe"
        collector._psutil = MagicMock()
        collector._psutil.Process.return_value = mock_proc

        # 1. Initially unlocked
        with patch.object(collector, "_is_screen_locked", return_value=False):
            obs1 = collector.observe()
            self.assertEqual(obs1.kind, "APPLICATION")
            self.assertEqual(obs1.process_name, "notepad.exe")

        # 2. Transition to locked -> emits COMPUTER_LOCK
        with patch.object(collector, "_is_screen_locked", return_value=True):
            obs_lock = collector.observe()
            self.assertEqual(obs_lock.kind, "COMPUTER_LOCK")
            self.assertIsNone(obs_lock.process_name)
            self.assertIsNone(obs_lock.window_title)

            # 3. Subsequent observation while still locked -> SKIP
            obs_still_locked = collector.observe()
            self.assertEqual(obs_still_locked.kind, "SKIP")

        # 4. Transition back to unlocked -> COMPUTER_UNLOCK
        with patch.object(collector, "_is_screen_locked", return_value=False):
            obs_unlock = collector.observe()
            self.assertEqual(obs_unlock.kind, "COMPUTER_UNLOCK")

            # 5. Subsequent observation while unlocked -> regular APPLICATION
            obs_resume = collector.observe()
            self.assertEqual(obs_resume.kind, "APPLICATION")
            self.assertEqual(obs_resume.process_name, "notepad.exe")

    def test_windows_collector_skips_excluded_applications(self) -> None:
        collector = WindowsCollector(self.config)
        collector._idle_seconds = lambda: 0.0
        collector._win32gui = MagicMock()
        collector._win32gui.GetForegroundWindow.return_value = 202
        collector._win32gui.GetWindowText.return_value = "Secret Chat"
        collector._win32process = MagicMock()
        collector._win32process.GetWindowThreadProcessId.return_value = (0, 5678)
        mock_proc = MagicMock()
        mock_proc.name.return_value = "whatsapp.exe"
        collector._psutil = MagicMock()
        collector._psutil.Process.return_value = mock_proc

        with patch.object(collector, "_is_screen_locked", return_value=False):
            obs = collector.observe()
            self.assertEqual(obs.kind, "SKIP")
            self.assertIsNone(obs.process_name)
            self.assertIsNone(obs.window_title)

    def test_windows_collector_dynamic_config_update(self) -> None:
        collector = WindowsCollector(self.config)
        self.assertIn("whatsapp.exe", collector._config.excluded_processes)
        self.assertNotIn("banking.exe", collector._config.excluded_processes)
        self.assertEqual(collector._config.idle_threshold_seconds, 300)

        new_config = self.config.with_tracking_settings(
            config_version=2,
            idle_threshold_seconds=900,
            excluded_processes=["banking.exe"],
        )
        collector.update_config(new_config)

        self.assertEqual(collector._config.config_version, 2)
        self.assertEqual(collector._config.idle_threshold_seconds, 900)
        self.assertIn("banking.exe", collector._config.excluded_processes)
        self.assertNotIn("whatsapp.exe", collector._config.excluded_processes)


if __name__ == "__main__":
    unittest.main()
