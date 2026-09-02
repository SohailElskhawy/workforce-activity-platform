# WorkLens Desktop Agent

The WorkLens agent sends privacy-scoped activity segments to the same backend pipeline used by the simulator. It supports a deterministic simulator on any supported Python platform and real foreground-window collection on Windows.

## Python setup

Use Python 3.12 or newer.

```bash
cd agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

For real Windows collection, install the optional dependency group as well:

```bash
python -m pip install -e ".[test,windows]"
```

## Environment file

Create `agent/.env` locally; do not commit it.

```dotenv
WORKLENS_API_URL=https://your-worklens-host.example
WORKLENS_DEVICE_ID=issued-by-manager-registration
WORKLENS_AGENT_TOKEN=shown-once-at-registration
WORKLENS_AGENT_VERSION=0.1.0
WORKLENS_IDLE_THRESHOLD_SECONDS=300
WORKLENS_EXCLUDED_PROCESSES=1password.exe,keepass.exe
```

`WORKLENS_API_URL`, `WORKLENS_DEVICE_ID`, and `WORKLENS_AGENT_TOKEN` are required. The agent lowercases process names before comparing them with `WORKLENS_EXCLUDED_PROCESSES`.

## Device registration

Each agent must use a manager-issued device ID and token:

1. Sign in as a manager.
2. Call the manager-protected `POST /api/agent/register` endpoint from an authenticated same-origin session with an active employee ID and a device name.
3. Record the returned `deviceId` and raw `token` in the device’s local `.env` file immediately. The backend retains only a peppered hash of the token.

The raw token is returned once and cannot be recovered later. To rotate a lost token, register a replacement device and deactivate the old device in the database/admin workflow. There is currently no dedicated web UI for registration.

## Simulator mode

With `.env` configured for a registered device, run:

```bash
cd agent
python -m worklens_agent.main --mode simulate
```

The simulator emits a deterministic AutoCAD, browser, idle, and Excel sequence. It is not a mock transport: it writes to the same local SQLite queue and calls the live `/api/agent/heartbeat` and `/api/agent/activities/batch` backend endpoints using the same authentication and batch format as the real agent.

## Real Windows mode

On Windows, after installing the `windows` optional dependencies, run:

```powershell
cd agent
python -m worklens_agent.main --mode real
```

The real collector reads the current foreground window and checks user idle time. It sends a heartbeat at startup and periodically, and attempts to upload queued activity every 15 seconds.

## Privacy behavior

The agent does not record keystrokes, screenshots, file contents, browser history, clipboard data, or network traffic. For an active, non-excluded foreground window it records application name, process name, window title, timestamps, and, for AutoCAD windows only, an extracted DWG filename when available.

For sensitive tools, list executable names in `WORKLENS_EXCLUDED_PROCESSES`, for example `1password.exe,keepass.exe`. An excluded process becomes `SKIP`: the current segment is closed and no segment is created for the excluded interval. Idle time becomes an `IDLE` segment after `WORKLENS_IDLE_THRESHOLD_SECONDS` (300 seconds by default).

## Offline queue and delivery

The agent stores pending segments in `agent/data/activity.db`. Network failures or non-success responses leave queued records in place for later retry. A successful upload marks only the acknowledged batch as uploaded. Event IDs are stable, and the backend has a `(deviceId, eventId)` uniqueness rule, so retrying an already delivered activity is safe.

## Testing

Install the test extra, then run:

```bash
cd agent
python -m pytest
```
