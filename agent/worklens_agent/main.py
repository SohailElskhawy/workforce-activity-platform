import argparse
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
import sys
import time

from worklens_agent.client import AgentClient
from worklens_agent.config import AgentConfig
from worklens_agent.models import Observation
from worklens_agent.queue import ActivityQueue
from worklens_agent.segmenter import SegmentBuilder
from worklens_agent.simulator import SimulatorCollector


logger = logging.getLogger(__name__)


def process_observations(
    observations: Iterable[Observation],
    segment_builder: SegmentBuilder,
    queue: ActivityQueue,
    finish_at: datetime,
) -> None:
    for observation in observations:
        for segment in segment_builder.observe(observation):
            queue.enqueue(segment)
    for segment in segment_builder.finish(finish_at):
        queue.enqueue(segment)


def run_simulator(config: AgentConfig) -> None:
    queue = ActivityQueue(Path("data") / "activity.db")
    client = AgentClient(config, queue)
    builder = SegmentBuilder()
    collector = SimulatorCollector()
    observations = list(collector.observations())
    last_upload = time.monotonic()
    last_heartbeat = last_upload
    last_observation: Observation | None = None
    try:
        client.send_heartbeat()
        for observation in observations:
            last_observation = observation
            for segment in builder.observe(observation):
                queue.enqueue(segment)
            now = time.monotonic()
            if now - last_upload >= 15:
                client.upload_pending()
                last_upload = now
            if now - last_heartbeat >= 30:
                client.send_heartbeat()
                last_heartbeat = now
            time.sleep(2)
    finally:
        finish_at = last_observation.at + timedelta(seconds=2) if last_observation else datetime.now(timezone.utc)
        for segment in builder.finish(finish_at):
            queue.enqueue(segment)
        client.upload_pending()
        client.close()
        queue.close()


def run_real(config: AgentConfig) -> None:
    from worklens_agent.windows_collector import WindowsCollector

    queue = ActivityQueue(Path("data") / "activity.db")
    client = AgentClient(config, queue)
    builder = SegmentBuilder()
    collector = WindowsCollector(config)
    last_upload = time.monotonic()
    last_heartbeat = last_upload
    try:
        client.send_heartbeat()
        while True:
            observation = collector.observe()
            for segment in builder.observe(observation):
                queue.enqueue(segment)
            now = time.monotonic()
            if now - last_upload >= 15:
                client.upload_pending()
                last_upload = now
            if now - last_heartbeat >= 30:
                client.send_heartbeat()
                last_heartbeat = now
            time.sleep(2)
    finally:
        for segment in builder.finish(datetime.now(timezone.utc)):
            queue.enqueue(segment)
        client.upload_pending()
        client.close()
        queue.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="WorkLens activity agent")
    parser.add_argument("--mode", choices=["simulate", "real"], required=True)
    args = parser.parse_args(argv)
    if args.mode == "real" and sys.platform != "win32":
        parser.error("Real collector requires Windows. Use --mode simulate on this machine.")
    config = AgentConfig.from_environment()
    if args.mode == "real":
        run_real(config)
    else:
        run_simulator(config)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    raise SystemExit(main())
