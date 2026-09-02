import logging
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from worklens_agent.runtime import (
    RuntimePaths,
    configure_file_logging,
    load_packaged_default_api_url,
)


class RuntimePathsTests(unittest.TestCase):
    def test_windows_paths_use_local_app_data(self) -> None:
        paths = RuntimePaths.for_current_user(
            {"LOCALAPPDATA": r"C:\\Users\\A\\AppData\\Local"}
        )

        self.assertEqual(
            paths.root, Path(r"C:\\Users\\A\\AppData\\Local") / "WorkLens"
        )
        self.assertEqual(paths.config_path, paths.root / "config.json")
        self.assertEqual(paths.database_path, paths.root / "activity.db")
        self.assertEqual(paths.log_path, paths.root / "logs" / "agent.log")

    def test_file_logging_creates_parent_directory_and_log_file(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            log_path = Path(tempdir) / "logs" / "agent.log"
            configure_file_logging(log_path)
            logging.getLogger("worklens.test.runtime").warning("persist me")

            self.assertIn("persist me", log_path.read_text(encoding="utf-8"))

    def test_packaged_default_url_accepts_windows_utf8_bom(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            resource_path = Path(tempdir) / "worklens_agent"
            resource_path.mkdir()
            (resource_path / "runtime-defaults.json").write_text(
                '{"apiUrl":"https://host.example/"}', encoding="utf-8-sig"
            )
            with (
                patch("worklens_agent.runtime.sys.frozen", True, create=True),
                patch("worklens_agent.runtime.sys._MEIPASS", tempdir, create=True),
            ):
                self.assertEqual(
                    load_packaged_default_api_url(), "https://host.example"
                )


if __name__ == "__main__":
    unittest.main()
