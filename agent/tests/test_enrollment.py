from pathlib import Path
import tempfile
import unittest

from worklens_agent.config import AgentConfig
from worklens_agent.enrollment import EnrollmentValues, save_verified_enrollment


class EnrollmentTests(unittest.TestCase):
    def test_verified_enrollment_writes_runtime_config(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            config_path = Path(tempdir) / "config.json"
            saved = save_verified_enrollment(
                config_path,
                EnrollmentValues("https://host.example", "PC-1", "issued-token"),
                verify=lambda config: True,
            )

            self.assertTrue(saved)
            self.assertEqual(
                AgentConfig.from_runtime_file(config_path).device_id, "PC-1"
            )

    def test_failed_enrollment_does_not_replace_existing_config(self) -> None:
        original = AgentConfig(
            api_url="https://host.example",
            device_id="old-device",
            agent_token="old-token",
            agent_version="0.1.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            config_path = Path(tempdir) / "config.json"
            original.write_runtime_file(config_path)
            saved = save_verified_enrollment(
                config_path,
                EnrollmentValues("https://host.example", "new-device", "new-token"),
                verify=lambda config: False,
            )

            self.assertFalse(saved)
            self.assertEqual(
                AgentConfig.from_runtime_file(config_path).device_id, "old-device"
            )

    def test_enrollment_requires_an_https_api_url(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            with self.assertRaisesRegex(ValueError, "HTTPS"):
                save_verified_enrollment(
                    Path(tempdir) / "config.json",
                    EnrollmentValues("http://host.example", "PC-1", "issued-token"),
                    verify=lambda config: True,
                )


if __name__ == "__main__":
    unittest.main()
