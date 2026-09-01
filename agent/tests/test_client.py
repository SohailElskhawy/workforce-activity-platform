from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

import httpx

from worklens_agent.client import AgentClient
from worklens_agent.config import AgentConfig
from worklens_agent.models import ActivitySegment
from worklens_agent.queue import ActivityQueue


class FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300


class FakeHttpClient:
    def __init__(self, responses: list[FakeResponse | Exception]) -> None:
        self.responses = responses
        self.calls: list[dict[str, object]] = []

    def post(self, url: str, **kwargs: object) -> FakeResponse:
        self.calls.append({"url": url, **kwargs})
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def segment() -> ActivitySegment:
    start_at = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
    return ActivitySegment(
        event_id="event-001",
        start_at=start_at,
        end_at=start_at + timedelta(seconds=10),
        type="APPLICATION",
        application_name="AutoCAD",
        process_name="acad.exe",
        window_title="ABC_A_Block.dwg",
        file_name="ABC_A_Block.dwg",
    )


class AgentClientTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.queue = ActivityQueue(Path(self.tempdir.name) / "activity.db")
        self.config = AgentConfig(
            api_url="https://demo.worklens.test/",
            device_id="PC-001",
            agent_token="agent-token",
            agent_version="0.1.0",
            idle_threshold_seconds=300,
            excluded_processes=frozenset(),
        )

    def tearDown(self) -> None:
        self.queue.close()
        self.tempdir.cleanup()

    def test_upload_marks_only_the_successfully_posted_queue_rows(self) -> None:
        self.queue.enqueue(segment())
        http_client = FakeHttpClient([FakeResponse(201)])
        client = AgentClient(self.config, self.queue, http_client=http_client)

        self.assertTrue(client.upload_pending())
        self.assertEqual(self.queue.pending(), [])
        self.assertEqual(http_client.calls[0]["url"], "https://demo.worklens.test/api/agent/activities/batch")
        self.assertEqual(http_client.calls[0]["headers"], {
            "Authorization": "Bearer agent-token",
            "X-Device-ID": "PC-001",
            "Content-Type": "application/json",
        })
        payload = http_client.calls[0]["json"]["activities"][0]
        self.assertEqual(set(payload), {"eventId", "startAt", "endAt", "type", "applicationName", "processName", "windowTitle", "fileName"})
        self.assertEqual(payload["eventId"], "event-001")

    def test_failed_upload_and_network_exception_leave_the_queue_pending(self) -> None:
        self.queue.enqueue(segment())
        http_client = FakeHttpClient([
            FakeResponse(500),
            httpx.ConnectError("offline", request=httpx.Request("POST", "https://demo.worklens.test")),
        ])
        client = AgentClient(self.config, self.queue, http_client=http_client)

        self.assertFalse(client.upload_pending())
        self.assertFalse(client.upload_pending())
        self.assertEqual([item.event_id for item in self.queue.pending()], ["event-001"])

    def test_heartbeat_posts_the_agent_version_with_device_authentication(self) -> None:
        http_client = FakeHttpClient([FakeResponse(200)])
        client = AgentClient(self.config, self.queue, http_client=http_client)

        self.assertTrue(client.send_heartbeat())
        self.assertEqual(http_client.calls[0]["url"], "https://demo.worklens.test/api/agent/heartbeat")
        heartbeat = http_client.calls[0]["json"]
        self.assertEqual(heartbeat["agentVersion"], "0.1.0")
        self.assertIn("timestamp", heartbeat)
        datetime.fromisoformat(heartbeat["timestamp"])


if __name__ == "__main__":
    unittest.main()
