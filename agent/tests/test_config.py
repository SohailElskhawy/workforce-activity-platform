from pathlib import Path
import tempfile
import unittest

from worklens_agent.config import AgentConfig


class RuntimeConfigurationTests(unittest.TestCase):
    def test_runtime_config_round_trips_credentials_and_settings(self) -> None:
        config = AgentConfig(
            api_url="https://host.example/",
            device_id="PC-1",
            agent_token="issued-token",
            agent_version="1.2.3",
            idle_threshold_seconds=120,
            excluded_processes=frozenset({"keepass.exe"}),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "config.json"
            config.write_runtime_file(path)
            loaded = AgentConfig.from_runtime_file(path)

        self.assertEqual(loaded.api_url, "https://host.example")
        self.assertEqual(loaded.device_id, "PC-1")
        self.assertEqual(loaded.agent_token, "issued-token")
        self.assertEqual(loaded.agent_version, "1.2.3")
        self.assertEqual(loaded.idle_threshold_seconds, 120)
        self.assertEqual(loaded.excluded_processes, frozenset({"keepass.exe"}))

    def test_token_is_encrypted_on_disk_not_plaintext(self) -> None:
        config = AgentConfig(
            api_url="https://host.example/",
            device_id="PC-SECURE",
            agent_token="super-secret-raw-token",
            agent_version="1.0.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "config.json"
            config.write_runtime_file(path)

            raw_file_content = path.read_text(encoding="utf-8")
            self.assertNotIn("super-secret-raw-token", raw_file_content)
            self.assertIn("agentTokenEncrypted", raw_file_content)

            loaded = AgentConfig.from_runtime_file(path)
            self.assertEqual(loaded.agent_token, "super-secret-raw-token")

    def test_migration_from_legacy_plaintext_token(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "config.json"
            path.write_text(
                '{"apiUrl":"https://host.example","deviceId":"PC-LEGACY","agentToken":"plaintext-secret-123"}',
                encoding="utf-8",
            )
            loaded = AgentConfig.from_runtime_file(path)
            self.assertEqual(loaded.agent_token, "plaintext-secret-123")

            # Verify the file on disk was automatically migrated and no longer has the raw secret
            migrated_content = path.read_text(encoding="utf-8")
            self.assertNotIn("plaintext-secret-123", migrated_content)
            self.assertIn("agentTokenEncrypted", migrated_content)

    def test_runtime_config_rejects_missing_token(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "config.json"
            path.write_text(
                '{"apiUrl":"https://host.example","deviceId":"PC-1"}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "required"):
                AgentConfig.from_runtime_file(path)


if __name__ == "__main__":
    unittest.main()
