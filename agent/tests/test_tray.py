import unittest

from worklens_agent.tray import AgentState, SystemTray


class AgentStateTests(unittest.TestCase):
    def test_default_agent_state(self) -> None:
        state = AgentState(agent_version="0.1.0", config_version=1)
        self.assertEqual(state.connection_status, "Connected")
        self.assertEqual(state.current_app, "—")
        self.assertEqual(state.current_project, "—")
        self.assertEqual(state.current_task, "—")
        self.assertEqual(state.format_today_active(), "0h 0m")
        self.assertEqual(state.format_today_idle(), "0m")

    def test_state_updates_and_time_formatting(self) -> None:
        state = AgentState(agent_version="0.1.0", config_version=1)

        state.update(
            connection_status="Offline / retrying",
            current_app="AutoCAD",
            current_project="ABC AVM",
            current_task="A Block Drawing",
            active_seconds_delta=20520,  # 5h 42m = 20520s
            idle_seconds_delta=2280,   # 38m = 2280s
            config_version=4,
        )

        self.assertEqual(state.connection_status, "Offline / retrying")
        self.assertEqual(state.current_app, "AutoCAD")
        self.assertEqual(state.current_project, "ABC AVM")
        self.assertEqual(state.current_task, "A Block Drawing")
        self.assertEqual(state.format_today_active(), "5h 42m")
        self.assertEqual(state.format_today_idle(), "38m")
        self.assertEqual(state.config_version, 4)

        summary = state.get_status_summary()
        self.assertIn("AutoCAD", summary)
        self.assertIn("ABC AVM", summary)
        self.assertIn("A Block Drawing", summary)
        self.assertIn("5h 42m", summary)
        self.assertIn("38m", summary)
        self.assertIn("v4", summary)

    def test_tray_initialization_does_not_crash_collector(self) -> None:
        state = AgentState()
        # SystemTray should gracefully handle non-GUI or test environments
        tray = SystemTray(state)
        # Calling stop before or without start should not raise
        tray.stop()


if __name__ == "__main__":
    unittest.main()
