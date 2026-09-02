import sys
from pathlib import Path

from worklens_agent.format import build_black_command


def test_build_black_command_uses_target_dir():
    target = Path("/tmp/project")

    assert build_black_command(target) == [
        sys.executable,
        "-m",
        "black",
        str(target),
    ]
