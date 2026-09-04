import unittest

from worklens_agent.autocad import extract_dwg_filename


class AutoCadFilenameTests(unittest.TestCase):
    def test_safely_handles_none_empty_and_whitespace_titles(self) -> None:
        self.assertIsNone(extract_dwg_filename(None))
        self.assertIsNone(extract_dwg_filename(""))
        self.assertIsNone(extract_dwg_filename("   "))

    def test_extracts_a_bracketed_dwg_title(self) -> None:
        self.assertEqual(
            extract_dwg_filename("Autodesk AutoCAD 2026 - [ABC_A_Block.dwg]"),
            "ABC_A_Block.dwg",
        )

    def test_extracts_bracketed_dwg_with_dirty_asterisk(self) -> None:
        self.assertEqual(
            extract_dwg_filename("Autodesk AutoCAD 2026 - [ABC_A_Block.dwg*]"),
            "ABC_A_Block.dwg",
        )

    def test_extracts_bracketed_dwg_with_read_only_suffix(self) -> None:
        self.assertEqual(
            extract_dwg_filename(
                "Autodesk AutoCAD 2026 - [ABC_A_Block.dwg (Read Only)]"
            ),
            "ABC_A_Block.dwg",
        )
        self.assertEqual(
            extract_dwg_filename(
                "Autodesk AutoCAD 2026 - [ABC_A_Block.dwg - Read Only]"
            ),
            "ABC_A_Block.dwg",
        )

    def test_extracts_bracketed_dwg_with_full_path(self) -> None:
        self.assertEqual(
            extract_dwg_filename(
                r"Autodesk AutoCAD 2026 - [C:\Projects\ABC_A_Block.dwg*]"
            ),
            "ABC_A_Block.dwg",
        )

    def test_extracts_dwg_prefix_format(self) -> None:
        self.assertEqual(
            extract_dwg_filename("ABC_A_Block.dwg - AutoCAD 2026"),
            "ABC_A_Block.dwg",
        )
        self.assertEqual(
            extract_dwg_filename("ABC_A_Block.dwg* - AutoCAD 2026"),
            "ABC_A_Block.dwg",
        )

    def test_extracts_path_dwg_prefix_format(self) -> None:
        self.assertEqual(
            extract_dwg_filename(r"C:\Projects\ABC_A_Block.dwg - AutoCAD"),
            "ABC_A_Block.dwg",
        )

    def test_extracts_a_path_dwg_title(self) -> None:
        self.assertEqual(
            extract_dwg_filename(r"AutoCAD - C:\Projects\ABC_B_Block.DWG"),
            "ABC_B_Block.DWG",
        )

    def test_returns_none_when_an_autocad_title_has_no_file(self) -> None:
        self.assertIsNone(extract_dwg_filename("Autodesk AutoCAD 2026"))
        self.assertIsNone(extract_dwg_filename("AutoCAD - Options"))
        self.assertIsNone(extract_dwg_filename("AutoCAD - Plot - Model"))

    def test_does_not_infer_a_dwg_from_another_application(self) -> None:
        self.assertIsNone(
            extract_dwg_filename("Chrome - ABC_A_Block.dwg documentation")
        )
        self.assertIsNone(
            extract_dwg_filename("Notepad - AutoCAD notes.txt")
        )

    def test_does_not_match_non_dwg_extensions(self) -> None:
        self.assertIsNone(
            extract_dwg_filename("AutoCAD - ABC_A_Block.dwg.bak")
        )
        self.assertIsNone(
            extract_dwg_filename("AutoCAD - ABC_A_Block.dwg.pdf")
        )


if __name__ == "__main__":
    unittest.main()

