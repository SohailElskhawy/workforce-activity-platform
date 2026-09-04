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

## Environment file (developer mode only)

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

1. Sign in as a manager and open the employee's detail page.
2. Select **Register agent device**, provide a device name, and save the displayed device ID and one-time token immediately.
3. For developer mode, record the returned `deviceId` and raw `token` in the device’s local `.env` file immediately. For the installed employee agent, enter them in the enrollment window instead. The backend retains only a peppered hash of the token.

The raw token is returned once and cannot be recovered later. To rotate a lost token, register a replacement device and deactivate the old device in the database/admin workflow.

## Windows employee installer

Employees install `WorkLensAgentSetup.exe`; they do not need Python, pip, PowerShell, a virtual environment, or an `.env` file. The installer opens the enrollment window, adds a Windows-login startup shortcut, and uses real collection mode.

See [employee installation instructions](../docs/worklens-agent-employee-installation.md) and the [developer packaging guide](../docs/worklens-agent-developer-guide.md).

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

## Offline queue, pruning, and secure storage

Developer runs store pending segments in `agent/data/activity.db`. Installed runs store their queue in `%LOCALAPPDATA%\WorkLens\activity.db`, alongside `%LOCALAPPDATA%\WorkLens\config.json` and rotating logs in `%LOCALAPPDATA%\WorkLens\logs\agent.log`.

* **Windows DPAPI Security**: In installed mode, the agent token is encrypted at rest using Windows DPAPI (`CryptProtectData`). Plaintext secrets are never stored on disk.
* **Safe Queue Pruning**: Successfully uploaded activities older than 7 days are automatically pruned from SQLite on startup and once every hour. Pending/unuploaded rows are NEVER deleted.
* **Idempotent Delivery**: Event IDs are stable, and the backend has a `(deviceId, eventId)` uniqueness rule, so retrying an already delivered activity is safe.

## Status visibility

To check agent health, connection status, and queue depth:

```powershell
python -m worklens_agent.main --status
```

## Testing

Run unit and integration tests:

```bash
cd agent
python -m unittest discover tests
```
