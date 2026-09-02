import unittest

from worklens_agent.autocad import extract_dwg_filename


class AutoCadFilenameTests(unittest.TestCase):
    def test_extracts_a_bracketed_dwg_title(self) -> None:
        self.assertEqual(
            extract_dwg_filename("Autodesk AutoCAD 2026 - [ABC_A_Block.dwg]"),
            "ABC_A_Block.dwg",
        )

    def test_extracts_a_path_dwg_title(self) -> None:
        self.assertEqual(
            extract_dwg_filename(r"AutoCAD - C:\Projects\ABC_B_Block.DWG"),
            "ABC_B_Block.DWG",
        )

    def test_returns_none_when_an_autocad_title_has_no_file(self) -> None:
        self.assertIsNone(extract_dwg_filename("Autodesk AutoCAD 2026"))

    def test_does_not_infer_a_dwg_from_another_application(self) -> None:
        self.assertIsNone(
            extract_dwg_filename("Chrome - ABC_A_Block.dwg documentation")
        )


if __name__ == "__main__":
    unittest.main()
