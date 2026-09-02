from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def build_black_command(target_dir: Path) -> list[str]:
    return [sys.executable, "-m", "black", str(target_dir)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Format all Python files in the agent project with Black."
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="Directory or file to format (default: current directory)",
    )
    args = parser.parse_args(argv)

    target = Path(args.path)
    cmd = build_black_command(target)
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
