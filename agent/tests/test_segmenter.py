from datetime import datetime, timedelta, timezone
import unittest

from worklens_agent.models import Observation
from worklens_agent.segmenter import SegmentBuilder


BASE_TIME = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)


def observation(
    offset_seconds: int,
    kind: str,
    application_name: str | None = None,
    file_name: str | None = None,
) -> Observation:
    return Observation(
        at=BASE_TIME + timedelta(seconds=offset_seconds),
        kind=kind,
        application_name=application_name,
        process_name=f"{application_name}.exe" if application_name else None,
        window_title=file_name or application_name,
        file_name=file_name,
    )


class SegmentBuilderTests(unittest.TestCase):
    def test_emits_application_and_idle_segments_when_state_changes(self) -> None:
        builder = SegmentBuilder()

        self.assertEqual(
            builder.observe(
                observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg")
            ),
            [],
        )
        self.assertEqual(
            builder.observe(
                observation(2, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg")
            ),
            [],
        )
        autocad = builder.observe(observation(4, "APPLICATION", "Chrome"))
        chrome = builder.observe(observation(8, "IDLE"))
        idle = builder.finish(BASE_TIME + timedelta(seconds=12))

        self.assertEqual(
            [
                (
                    segment.type,
                    segment.application_name,
                    segment.file_name,
                    segment.duration_seconds,
                )
                for segment in autocad + chrome + idle
            ],
            [
                ("APPLICATION", "AutoCAD", "ABC_A_Block.dwg", 4),
                ("APPLICATION", "Chrome", None, 4),
                ("IDLE", None, None, 4),
            ],
        )

    def test_flushes_unchanged_activity_every_five_minutes_and_continues_tracking(
        self,
    ) -> None:
        builder = SegmentBuilder(max_segment_seconds=300)

        builder.observe(observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        flushed = builder.observe(
            observation(300, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg")
        )
        trailing = builder.finish(BASE_TIME + timedelta(seconds=302))

        self.assertEqual(
            [segment.duration_seconds for segment in flushed + trailing], [300, 2]
        )
        self.assertEqual(
            [segment.file_name for segment in flushed + trailing],
            ["ABC_A_Block.dwg", "ABC_A_Block.dwg"],
        )

    def test_skip_closes_activity_without_recording_the_excluded_period(self) -> None:
        builder = SegmentBuilder()

        builder.observe(observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        closed = builder.observe(observation(10, "SKIP"))
        self.assertEqual(builder.finish(BASE_TIME + timedelta(seconds=20)), [])

        self.assertEqual(
            [(segment.type, segment.duration_seconds) for segment in closed],
            [("APPLICATION", 10)],
        )

    def test_switching_dwg_files_closes_previous_and_starts_new_dwg_segment(
        self,
    ) -> None:
        builder = SegmentBuilder()

        builder.observe(observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        builder.observe(observation(2, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        closed_a = builder.observe(
            observation(10, "APPLICATION", "AutoCAD", "ABC_B_Block.dwg")
        )
        builder.observe(observation(12, "APPLICATION", "AutoCAD", "ABC_B_Block.dwg"))
        closed_b = builder.finish(BASE_TIME + timedelta(seconds=20))

        self.assertEqual(len(closed_a), 1)
        self.assertEqual(closed_a[0].type, "APPLICATION")
        self.assertEqual(closed_a[0].file_name, "ABC_A_Block.dwg")
        self.assertEqual(closed_a[0].duration_seconds, 10)

        self.assertEqual(len(closed_b), 1)
        self.assertEqual(closed_b[0].type, "APPLICATION")
        self.assertEqual(closed_b[0].file_name, "ABC_B_Block.dwg")
        self.assertEqual(closed_b[0].duration_seconds, 10)

    def test_application_idle_application_dwg_transition(self) -> None:
        builder = SegmentBuilder()

        builder.observe(observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        dwg_closed = builder.observe(observation(10, "IDLE"))
        builder.observe(observation(12, "IDLE"))
        idle_closed = builder.observe(
            observation(25, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg")
        )
        resumed_dwg_closed = builder.finish(BASE_TIME + timedelta(seconds=35))

        self.assertEqual(
            [
                (
                    segment.type,
                    segment.application_name,
                    segment.file_name,
                    segment.duration_seconds,
                )
                for segment in dwg_closed + idle_closed + resumed_dwg_closed
            ],
            [
                ("APPLICATION", "AutoCAD", "ABC_A_Block.dwg", 10),
                ("IDLE", None, None, 15),
                ("APPLICATION", "AutoCAD", "ABC_A_Block.dwg", 10),
            ],
        )

    def test_computer_lock_closes_current_application_and_emits_lock_event(
        self,
    ) -> None:
        builder = SegmentBuilder()

        # Running AutoCAD for 60 seconds
        builder.observe(observation(0, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        builder.observe(observation(30, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))

        # Lock event occurs at second 60
        lock_segments = builder.observe(observation(60, "COMPUTER_LOCK"))

        self.assertEqual(len(lock_segments), 2)
        # First segment: closed application
        self.assertEqual(lock_segments[0].type, "APPLICATION")
        self.assertEqual(lock_segments[0].application_name, "AutoCAD")
        self.assertEqual(lock_segments[0].duration_seconds, 60)

        # Second segment: lock event
        self.assertEqual(lock_segments[1].type, "COMPUTER_LOCK")
        self.assertIsNone(lock_segments[1].application_name)
        self.assertEqual(lock_segments[1].duration_seconds, 1)

    def test_locked_duration_with_skip_does_not_count_as_activity_or_idle(
        self,
    ) -> None:
        builder = SegmentBuilder()

        # Lock at 0
        lock_segments = builder.observe(observation(0, "COMPUTER_LOCK"))
        self.assertEqual(len(lock_segments), 1)
        self.assertEqual(lock_segments[0].type, "COMPUTER_LOCK")

        # Computer remains locked for 900 seconds (15 minutes). Observations are SKIP.
        self.assertEqual(builder.observe(observation(300, "SKIP")), [])
        self.assertEqual(builder.observe(observation(600, "SKIP")), [])
        self.assertEqual(builder.observe(observation(900, "SKIP")), [])

        # Unlock at 900
        unlock_segments = builder.observe(observation(900, "COMPUTER_UNLOCK"))
        self.assertEqual(len(unlock_segments), 1)
        self.assertEqual(unlock_segments[0].type, "COMPUTER_UNLOCK")

        # Resumes AutoCAD at 902
        builder.observe(observation(902, "APPLICATION", "AutoCAD", "ABC_A_Block.dwg"))
        resumed = builder.finish(BASE_TIME + timedelta(seconds=930))

        self.assertEqual(len(resumed), 1)
        self.assertEqual(resumed[0].type, "APPLICATION")
        self.assertEqual(resumed[0].application_name, "AutoCAD")
        # Only the 28 seconds of AutoCAD work after unlock is counted
        self.assertEqual(resumed[0].duration_seconds, 28)


if __name__ == "__main__":
    unittest.main()

