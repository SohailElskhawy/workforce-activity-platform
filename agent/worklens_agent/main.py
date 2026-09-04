import argparse
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
import sys
import time

from worklens_agent.client import AgentClient
from worklens_agent.config import AgentConfig
from worklens_agent.enrollment import enroll
from worklens_agent.models import Observation
from worklens_agent.queue import ActivityQueue
from worklens_agent.runtime import (
    RuntimePaths,
    configure_file_logging,
    load_packaged_default_api_url,
)
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


def print_agent_status(paths: RuntimePaths) -> int:
    default_api_url = load_packaged_default_api_url()
    print("=== WorkLens Agent Status ===")
    print(f"Runtime Root: {paths.root}")
    print(f"Log File:     {paths.log_path}")
    print(f"Database:     {paths.database_path}")

    try:
        config = AgentConfig.from_runtime_file(paths.config_path, default_api_url)
    except (ValueError, FileNotFoundError):
        print("Status:       CONFIGURATION REQUIRED (Not enrolled)")
        print("Run with --enroll to configure the agent.")
        return 1

    print(f"Device ID:    {config.device_id}")
    print(f"API URL:      {config.api_url}")
    print(f"Version:      {config.agent_version}")

    queue = ActivityQueue(paths.database_path)
    pending_items = queue.pending()
    print(f"Local Queue:  {len(pending_items)} pending segment(s)")

    client = AgentClient(config, queue)
    try:
        hb_success = client.send_heartbeat()
        if hb_success:
            print("Status:       CONNECTED (Online)")
        else:
            print("Status:       OFFLINE / AUTHENTICATION REJECTED")
    except Exception as err:
        print(f"Status:       OFFLINE ({err})")
    finally:
        client.close()
        queue.close()

    print("=============================")
    return 0


def run_simulator(config: AgentConfig, database_path: Path | None = None) -> None:
    queue = ActivityQueue(database_path or Path("data") / "activity.db")
    client = AgentClient(config, queue)
    builder = SegmentBuilder()
    collector = SimulatorCollector()
    observations = list(collector.observations())
    last_upload = time.monotonic()
    last_heartbeat = last_upload
    last_observation: Observation | None = None
    try:
        try:
            client.send_heartbeat()
        except Exception as error:
            logger.warning("Initial heartbeat error: %s", error)
        for observation in observations:
            last_observation = observation
            for segment in builder.observe(observation):
                queue.enqueue(segment)
            now = time.monotonic()
            if now - last_upload >= 15:
                try:
                    client.upload_pending()
                except Exception as error:
                    logger.warning("Upload error: %s", error)
                last_upload = now
            if now - last_heartbeat >= 30:
                try:
                    client.send_heartbeat()
                except Exception as error:
                    logger.warning("Heartbeat error: %s", error)
                last_heartbeat = now
            time.sleep(2)
    finally:
        finish_at = (
            last_observation.at + timedelta(seconds=2)
            if last_observation
            else datetime.now(timezone.utc)
        )
        for segment in builder.finish(finish_at):
            queue.enqueue(segment)
        try:
            client.upload_pending()
        except Exception:
            pass
        client.close()
        queue.close()


def run_real(config: AgentConfig, database_path: Path | None = None) -> None:
    from worklens_agent.windows_collector import WindowsCollector

    queue = ActivityQueue(database_path or Path("data") / "activity.db")
    client = AgentClient(config, queue)
    builder = SegmentBuilder()
    collector = WindowsCollector(config)
    last_upload = time.monotonic()
    last_heartbeat = last_upload
    try:
        try:
            client.send_heartbeat()
        except Exception as error:
            logger.warning("Initial heartbeat error: %s", error)
        while True:
            try:
                observation = collector.observe()
                for segment in builder.observe(observation):
                    queue.enqueue(segment)
            except Exception as error:
                logger.error("Error collecting activity observation: %s", error)

            now = time.monotonic()
            if now - last_upload >= 15:
                try:
                    client.upload_pending()
                except Exception as error:
                    logger.warning("Upload pending error: %s", error)
                last_upload = now
            if now - last_heartbeat >= 30:
                try:
                    client.send_heartbeat()
                except Exception as error:
                    logger.warning("Heartbeat error: %s", error)
                last_heartbeat = now
            time.sleep(2)
    finally:
        for segment in builder.finish(datetime.now(timezone.utc)):
            queue.enqueue(segment)
        try:
            client.upload_pending()
        except Exception:
            pass
        client.close()
        queue.close()


def is_packaged() -> bool:
    return bool(getattr(sys, "frozen", False))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="WorkLens activity agent")
    parser.add_argument("--mode", choices=["simulate", "real"], default="real")
    parser.add_argument("--enroll", action="store_true")
    parser.add_argument("--status", action="store_true", help="Print agent operational status and verify connectivity")
    parser.add_argument("--runtime-dir", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.mode == "real" and sys.platform != "win32":
        parser.error(
            "Real collector requires Windows. Use --mode simulate on this machine."
        )
    uses_runtime_config = is_packaged() or args.runtime_dir is not None or args.enroll or args.status
    paths = (
        RuntimePaths(args.runtime_dir)
        if args.runtime_dir
        else RuntimePaths.for_current_user()
    )
    if args.status:
        return print_agent_status(paths)
    if uses_runtime_config:
        configure_file_logging(paths.log_path)
        default_api_url = load_packaged_default_api_url()
        if args.enroll:
            return 0 if enroll(paths, default_api_url) else 1
        try:
            config = AgentConfig.from_runtime_file(paths.config_path, default_api_url)
        except ValueError:
            logger.info("WorkLens needs enrollment before collection can start.")
            if not enroll(paths, default_api_url):
                return 1
            config = AgentConfig.from_runtime_file(paths.config_path, default_api_url)
    else:
        config = AgentConfig.from_environment()
    if args.mode == "real":
        if uses_runtime_config:
            run_real(config, paths.database_path)
        else:
            run_real(config)
    else:
        if uses_runtime_config:
            run_simulator(config, paths.database_path)
        else:
            run_simulator(config)
    return 0


if __name__ == "__main__":
    if not is_packaged():
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    raise SystemExit(main())
