# WorkLens Windows Agent Packaging Design

## Goal

Deliver the existing WorkLens Python Windows agent as a normal employee-facing
installer without changing its activity collection, device authentication,
offline queue, heartbeat, or ingestion API contracts.

## Scope and constraints

- The installed application runs in the logged-in employee's interactive
  Windows session. It is not a Windows service.
- Existing developer commands remain supported:
  `python -m worklens_agent.main --mode real` and
  `python -m worklens_agent.main --mode simulate`.
- The installed application starts in real mode by default.
- Installed application files are immutable under Program Files. Mutable
  configuration, SQLite data, and logs remain in `%LOCALAPPDATA%\\WorkLens`.
- No `.env` file, Python installation, pip, PowerShell, virtual environment,
  or terminal is required for an employee.
- No production device token or other secret is stored in source code,
  PyInstaller build scripts, installer scripts, or installer defaults.
- The hosted HTTPS API URL may be supplied as a build default, installer
  default, or during enrollment. Enrollment remains able to override it.
- Simulator mode remains available to developers but is never selected by the
  normal installed startup path.
- Out of scope: auto-update, MSI, Intune, Group Policy, Windows service,
  enterprise deployment, and a full tray UI.

## Existing contract preserved

The following components are retained without an architectural rewrite:

- `WindowsCollector`, idle detection, and AutoCAD/DWG filename extraction.
- `SegmentBuilder` and activity segment payload shape.
- `ActivityQueue` SQLite persistence and stable event IDs.
- `AgentClient` heartbeat and batch endpoints, bearer token and device headers,
  retry behavior, and idempotent server ingestion.
- `SimulatorCollector` and existing development modes.

Production preflight against the supplied hosted application confirmed an
authenticated heartbeat receives HTTP 200 and a UUID-formatted activity batch
is accepted. A non-UUID probe correctly received HTTP 400 from API validation.

## Runtime configuration and data

A small runtime-path abstraction resolves the installed per-user directory as
`%LOCALAPPDATA%\\WorkLens` on Windows. It contains:

```
%LOCALAPPDATA%\\WorkLens\\
  config.json       # API URL, device ID, device token, non-secret settings
  activity.db       # existing SQLite pending-activity queue
  logs\\agent.log    # rotating operational log
```

`config.json` has the same three required credentials as the current `.env`
file. It is stored in the employee's Windows profile, rather than Program
Files, and is never included in the installer. The raw manager-issued device
token remains device-local; the hosted backend continues to retain only its
hash. The installer and source contain no device token.

For source/developer execution, `AgentConfig.from_environment()` continues to
load `.env` and environment variables. Installed execution first uses the
runtime file; no developer configuration is required by employees.

## Enrollment

The executable provides an explicit `--enroll` path and also invokes that path
when an installed run has no valid runtime configuration. A small standard
library Tk dialog collects:

1. Hosted HTTPS API base URL, prefilled from a non-secret build default when
   supplied.
2. Manager-issued device ID.
3. One-time device token.

The dialog validates that all values are present and sends the existing
heartbeat request before writing `config.json`. Failure leaves the prior
configuration unchanged and displays an actionable error. Re-running
`WorkLensAgent.exe --enroll` is the supported way to rotate a device token or
change the hosted API URL.

## Agent execution

`main` retains `--mode real` and `--mode simulate`. The mode has a real-mode
default only for the packaged employee executable. Queue and logging paths are
injected into the existing real/simulator loops rather than changing collection
or delivery logic. On orderly close, existing shutdown behavior still flushes
the segment builder and attempts an upload; unsent rows stay in SQLite.

The installed app uses windowed mode so employees do not see a console. Errors
are written to the runtime log. The process remains in the user's session, so
foreground window and idle APIs remain accessible.

## Build and installer

The developer build script runs PyInstaller on Windows in `--onedir` and
`--windowed` mode, producing:

```
agent/dist/WorkLensAgent/WorkLensAgent.exe
```

`--onedir` is chosen for demo reliability: native `pywin32` dependencies,
Tk enrollment support, and certificates are installed as conventional files
instead of unpacking to a temporary directory each launch.

The Inno Setup script packages that directory into a conventional installer:

- installs immutable files under `{autopf}\\WorkLens Agent`;
- adds a standard Apps/Installed Programs uninstall entry;
- runs enrollment after install;
- creates a current-user Startup shortcut targeting
  `WorkLensAgent.exe --mode real`;
- deletes the application's `%LOCALAPPDATA%\\WorkLens` data on uninstall,
  including device configuration, queue, and logs.

The installer output is:

```
agent/installer/output/WorkLensAgentSetup.exe
```

The uninstall deletion is deliberate: an employee/device that is removed from
the machine should not leave its token or queued activity behind. It is
irreversible, and the employee instructions call this out.

## Testing strategy

Automated tests cover runtime path resolution, runtime config read/write and
environment compatibility, parser/default behavior, and existing queue/client
semantics. The full existing agent test suite is run after changes.

On a Windows build machine, the build script, PyInstaller output, and Inno
Setup compilation are exercised. A separate clean Windows machine performs
the employee flow: install/enroll, dashboard heartbeat and activity, queue
persistence and offline retry, restart/logoff/reboot startup, duplicate retry,
AutoCAD when available, uninstallation, and verification that Python and
terminal usage are unnecessary.

## Known demo limitations

- Enrollment requires a manager to provide a valid device ID and one-time
  token; there is no manager registration UI in scope.
- The startup shortcut begins after Windows log-in; it does not collect before
  a user has an interactive session.
- The demo uses user-profile file permissions for `config.json`; it does not
  add DPAPI encryption or enterprise credential management.
- Windows-native packaging and installer execution cannot be completed from a
  non-Windows development host.
