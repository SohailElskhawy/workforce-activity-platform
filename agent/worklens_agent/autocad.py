from pathlib import PureWindowsPath
import re


BRACKETED_DWG = re.compile(r"\[([^\]\r\n]+\.dwg)\]", re.IGNORECASE)
PATH_DWG = re.compile(r"\bAutoCAD\b.*?-\s*(.+?\.dwg)\s*$", re.IGNORECASE)


def extract_dwg_filename(window_title: str) -> str | None:
    if "autocad" not in window_title.casefold():
        return None
    bracketed = BRACKETED_DWG.search(window_title)
    if bracketed:
        return PureWindowsPath(bracketed.group(1)).name
    path = PATH_DWG.search(window_title)
    if path:
        return PureWindowsPath(path.group(1)).name
    return None
