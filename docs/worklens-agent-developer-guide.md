# WorkLens Agent developer and release guide

## Development modes

From `agent/`, keep using the existing commands with a local developer `.env`:

```powershell
python -m worklens_agent.main --mode real
python -m worklens_agent.main --mode simulate
```

The installed executable uses `%LOCALAPPDATA%\WorkLens\config.json` instead. Reopen enrollment without a terminal through the Start-menu **Configure WorkLens Agent** shortcut, or run `WorkLensAgent.exe --enroll` when diagnosing a release.

## Windows build prerequisites

- Windows 10/11 with Python 3.12 or newer.
- Inno Setup 6 installed, including `ISCC.exe`.
- A checkout of this repository and a developer-issued device credential only for verification. Never place the token in source, a build script, a test fixture, command history intended for sharing, or a committed `.env`.

## Build the executable

Run from a Windows developer shell:

```powershell
cd agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[windows,test]"
.\scripts\build-windows.ps1 -DefaultApiUrl "https://workforce-activity-platform-lyart.vercel.app"
```

The non-secret `-DefaultApiUrl` is embedded only as the enrollment dialog’s initial value. Device ID and token are never embedded. The executable is produced at:

```text
agent\dist\WorkLensAgent\WorkLensAgent.exe
```

## Build the installer

After building the executable, run:

```powershell
cd agent
.\installer\build-installer.ps1
```

If Inno Setup is installed elsewhere, supply its compiler explicitly:

```powershell
.\installer\build-installer.ps1 -InnoSetupCompiler "C:\Path\To\ISCC.exe"
```

The installer is written to:

```text
agent\installer\output\WorkLensAgentSetup.exe
```

## Installed runtime behavior

The normal installer uses PyInstaller `--onedir --windowed` mode and installs immutable files under Program Files. Inno Setup creates a current-user Startup shortcut that invokes `WorkLensAgent.exe --mode real`. This is intentionally not a Windows service: foreground-window and idle APIs must execute in the logged-in employee session.

The queue, enrollment configuration, and log are stored in `%LOCALAPPDATA%\WorkLens`. The install-time enrollment call validates the supplied hosted API/device credentials with the existing heartbeat API before saving the configuration. A restart/reboot does not alter this state.

## Hosted verification

Use an externally supplied test credential to check the live agent before distributing an installer. Confirm an authenticated `POST /api/agent/heartbeat` returns success, then send an existing-format UUID activity through `POST /api/agent/activities/batch`; inspect the manager dashboard afterward. Do not paste the credential in ticket comments, logs, docs, or this repository.

## Release checks

Follow [the Windows acceptance checklist](worklens-agent-test-checklist.md) on a fresh Windows machine with no Python installed. Building with PyInstaller or compiling Inno Setup is not a substitute for that test.
