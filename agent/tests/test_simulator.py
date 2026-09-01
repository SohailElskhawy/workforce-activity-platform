from datetime import datetime, timezone
import unittest

from worklens_agent.simulator import SimulatorCollector


class SimulatorCollectorTests(unittest.TestCase):
    def test_emits_the_repeatable_demo_sequence(self) -> None:
        start_at = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
        observations = list(SimulatorCollector(start_at=start_at, step_seconds=5).observations())

        self.assertEqual([(item.kind, item.application_name, item.file_name) for item in observations], [
            ("APPLICATION", "AutoCAD", "ABC_A_Block.dwg"),
            ("APPLICATION", "Chrome", None),
            ("APPLICATION", "AutoCAD", "ABC_B_Block.dwg"),
            ("IDLE", None, None),
            ("APPLICATION", "Excel", None),
        ])
        self.assertEqual([int((item.at - start_at).total_seconds()) for item in observations], [0, 5, 10, 15, 20])


if __name__ == "__main__":
    unittest.main()
