from datetime import datetime, timedelta

from worklens_agent.models import ActivitySegment, Observation


class SegmentBuilder:
    def __init__(self, max_segment_seconds: int = 300) -> None:
        self.max_segment_seconds = max_segment_seconds
        self._current: Observation | None = None

    def observe(self, observation: Observation) -> list[ActivitySegment]:
        if observation.kind == "SKIP":
            return self._close_current(observation.at)

        if observation.kind in ("COMPUTER_LOCK", "COMPUTER_UNLOCK"):
            closed = self._close_current(observation.at)
            event_segment = ActivitySegment(
                start_at=observation.at,
                end_at=observation.at + timedelta(seconds=1),
                type=observation.kind,
                application_name=None,
                process_name=None,
                window_title=None,
                file_name=None,
            )
            self._current = None
            return closed + [event_segment]

        if self._current is None:
            self._current = observation
            return []

        if self._same_state(self._current, observation):
            if (
                observation.at - self._current.at
            ).total_seconds() < self.max_segment_seconds:
                return []
            closed = self._close_current(observation.at)
            self._current = observation
            return closed

        closed = self._close_current(observation.at)
        self._current = observation
        return closed

    def finish(self, at: datetime) -> list[ActivitySegment]:
        return self._close_current(at)

    def _close_current(self, end_at: datetime) -> list[ActivitySegment]:
        if self._current is None or end_at <= self._current.at:
            self._current = (
                None if self._current and end_at > self._current.at else self._current
            )
            return []

        current = self._current
        self._current = None
        return [
            ActivitySegment(
                start_at=current.at,
                end_at=end_at,
                type=current.kind,
                application_name=(
                    current.application_name if current.kind == "APPLICATION" else None
                ),
                process_name=(
                    current.process_name if current.kind == "APPLICATION" else None
                ),
                window_title=(
                    current.window_title if current.kind == "APPLICATION" else None
                ),
                file_name=current.file_name if current.kind == "APPLICATION" else None,
            )
        ]

    @staticmethod
    def _same_state(current: Observation, next_observation: Observation) -> bool:
        return (
            current.kind == next_observation.kind
            and current.application_name == next_observation.application_name
            and current.process_name == next_observation.process_name
            and current.window_title == next_observation.window_title
            and current.file_name == next_observation.file_name
        )
