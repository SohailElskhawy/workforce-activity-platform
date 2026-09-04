from pathlib import PureWindowsPath
import re


BRACKETED_DWG = re.compile(
    r"\[\s*(?:.*?[\\/])?([^\\/\]\r\n]+?\.dwg)[*\s]*(?:\([^)]*\)|-\s*read[\s-]*only)?\s*\]",
    re.IGNORECASE,
)
PREFIX_DWG = re.compile(
    r"^\s*(?:.*?[\\/])?([^\\/\r\n]+?\.dwg)[*\s]*(?:\([^)]*\)|-\s*read[\s-]*only)?\s*-\s*.*?\bAutoCAD\b",
    re.IGNORECASE,
)
SUFFIX_DWG = re.compile(
    r"\bAutoCAD\b.*?-\s*(?:.*?[\\/])?([^\\/\r\n]+?\.dwg)[*\s]*(?:\([^)]*\)|-\s*read[\s-]*only)?\s*$",
    re.IGNORECASE,
)


def extract_dwg_filename(window_title: str | None) -> str | None:
    if not window_title or not isinstance(window_title, str):
        return None
    cleaned = window_title.strip()
    if not cleaned or "autocad" not in cleaned.casefold():
        return None
    for pattern in (BRACKETED_DWG, PREFIX_DWG, SUFFIX_DWG):
        match = pattern.search(cleaned)
        if match:
            return PureWindowsPath(match.group(1)).name
    return None

