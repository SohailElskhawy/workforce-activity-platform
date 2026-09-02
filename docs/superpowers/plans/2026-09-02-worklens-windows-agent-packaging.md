# WorkLens Windows Agent Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the existing WorkLens Windows collector as a self-contained employee installer with enrollment, per-user persistent data, and Windows-logon startup.

**Architecture:** Preserve collection and delivery. Add only runtime-path, JSON config, enrollment, and logging adapters; package the current entry point with PyInstaller and install the result through Inno Setup.

**Tech Stack:** Python 3.12, httpx, pywin32, tkinter, SQLite, pytest, PyInstaller, Inno Setup 6, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-02-worklens-windows-agent-packaging-design.md`

## Global Constraints

- No Windows service: the executable always runs in the logged-in user's interactive session.
- Preserve `python -m worklens_agent.main --mode real` and `python -m worklens_agent.main --mode simulate`.
- Installed normal mode is real; simulator remains available only by explicit developer selection.
- Store installed mutable state only in `%LOCALAPPDATA%\\WorkLens`.
- Never put a device token, `.env`, or production secret in source, installer, defaults, or docs.
- Make the hosted HTTPS base URL a non-secret build default and allow enrollment to change it.
- Do not alter existing heartbeat/batch schemas, SQLite retry/idempotency, collector, idle, AutoCAD/DWG, or simulator behavior.

---

### Task 1: Runtime paths and persistent configuration

**Files:**
- Create: `agent/worklens_agent/runtime.py`
- Modify: `agent/worklens_agent/config.py`
- Create: `agent/tests/test_runtime.py`
- Create: `agent/tests/test_config.py`

**Interfaces:**
- `RuntimePaths.for_current_user(environment: Mapping[str, str] | None = None) -> RuntimePaths`; properties: `root`, `config_path`, `database_path`, `log_path`.
- `load_packaged_default_api_url() -> str`; `configure_file_logging(log_path: Path) -> None`.
- `AgentConfig.from_runtime_file(path: Path, default_api_url: str = "") -> AgentConfig`; `AgentConfig.write_runtime_file(path: Path) -> None`.
- `AgentConfig.from_environment()` stays unmodified as the developer entry path.

- [ ] **Step 1: Write failing path/logging tests**

```python
def test_windows_paths_use_local_app_data() -> None:
    paths = RuntimePaths.for_current_user({"LOCALAPPDATA": r"C:\\Users\\A\\AppData\\Local"})
    assert paths.root == Path(r"C:\\Users\\A\\AppData\\Local") / "WorkLens"
    assert paths.database_path == paths.root / "activity.db"

def test_logging_creates_file(tmp_path: Path) -> None:
    log_path = tmp_path / "logs" / "agent.log"
    configure_file_logging(log_path)
    logging.getLogger("worklens.test").warning("persist me")
    assert "persist me" in log_path.read_text(encoding="utf-8")
```

- [ ] **Step 2: Verify failure**

Run: `cd agent && python -m pytest tests/test_runtime.py -v`

Expected: FAIL because the runtime module does not exist.

- [ ] **Step 3: Implement `RuntimePaths` and logging**

```python
@dataclass(frozen=True)
class RuntimePaths:
    root: Path

    @property
    def config_path(self) -> Path:
        return self.root / "config.json"

    @classmethod
    def for_current_user(cls, environment=None) -> "RuntimePaths":
        env = os.environ if environment is None else environment
        base = Path(env["LOCALAPPDATA"]) if env.get("LOCALAPPDATA") else Path.home() / ".local" / "share"
        return cls(base / "WorkLens")
```

Add database/log properties, create parents before opening a UTF-8 `FileHandler`, and read generated `runtime-defaults.json` only when present.

- [ ] **Step 4: Write failing JSON config tests and implement them**

```python
def test_runtime_config_round_trips_credentials(tmp_path: Path) -> None:
    config = AgentConfig("https://host.example", "PC-1", "issued-token", "0.1.0", 300, frozenset())
    config.write_runtime_file(tmp_path / "config.json")
    assert AgentConfig.from_runtime_file(tmp_path / "config.json") == config

def test_runtime_config_rejects_missing_token(tmp_path: Path) -> None:
    (tmp_path / "config.json").write_text('{"apiUrl":"https://host.example","deviceId":"PC-1"}', encoding="utf-8")
    with pytest.raises(ValueError, match="required"):
        AgentConfig.from_runtime_file(tmp_path / "config.json")
```

Run: `cd agent && python -m pytest tests/test_config.py -v`

Expected: FAIL before methods exist; PASS after adding JSON keys `apiUrl`, `deviceId`, `agentToken`, `agentVersion`, `idleThresholdSeconds`, and `excludedProcesses`. Write atomically through a sibling temporary file; JSON loading must not call `load_dotenv()`.

- [ ] **Step 5: Run tests and commit**

Run: `cd agent && python -m pytest tests/test_runtime.py tests/test_config.py tests/test_client.py -v`

Expected: PASS. Commit message: `feat(agent): persist installed runtime configuration`.

### Task 2: Enrollment and installed execution

**Files:**
- Create: `agent/worklens_agent/enrollment.py`
- Modify: `agent/worklens_agent/main.py`
- Modify: `agent/tests/test_main.py`
- Create: `agent/tests/test_enrollment.py`

**Interfaces:**
- `EnrollmentValues(api_url: str, device_id: str, agent_token: str)`.
- `save_verified_enrollment(config_path: Path, values: EnrollmentValues, verify: Callable[[AgentConfig], bool]) -> bool`.
- `enroll(paths: RuntimePaths, default_api_url: str = "") -> bool`.
- `run_real(config: AgentConfig, database_path: Path)` and `run_simulator(config: AgentConfig, database_path: Path)`.

- [ ] **Step 1: Write failing enrollment tests**

```python
def test_verified_enrollment_writes_config(tmp_path: Path) -> None:
    values = EnrollmentValues("https://host.example", "PC-1", "issued-token")
    assert save_verified_enrollment(tmp_path / "config.json", values, lambda config: True)
    assert AgentConfig.from_runtime_file(tmp_path / "config.json").device_id == "PC-1"

def test_failed_enrollment_keeps_previous_config(tmp_path: Path) -> None:
    old = AgentConfig("https://host.example", "old", "old-token", "0.1.0", 300, frozenset())
    old.write_runtime_file(tmp_path / "config.json")
    assert not save_verified_enrollment(tmp_path / "config.json", EnrollmentValues("https://host.example", "new", "new-token"), lambda config: False)
    assert AgentConfig.from_runtime_file(tmp_path / "config.json").device_id == "old"
```

- [ ] **Step 2: Verify failure and implement enrollment**

Run: `cd agent && python -m pytest tests/test_enrollment.py -v`

Expected: FAIL before the module; PASS afterward. `save_verified_enrollment` must use existing `AgentClient.send_heartbeat()` and save only after success. `enroll` uses tkinter, prefills only the API URL, masks the token, returns false on cancel, and never logs or displays the token.

- [ ] **Step 3: Write failing main tests**

```python
def test_packaged_default_runs_real_mode(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(main_module, "is_packaged", lambda: True)
    with patch.object(main_module, "run_real") as run_real:
        main_module.main(["--runtime-dir", str(tmp_path)])
    run_real.assert_called_once()

def test_developer_simulator_still_uses_environment() -> None:
    with patch.object(main_module.AgentConfig, "from_environment", return_value=test_config) as from_environment:
        main_module.main(["--mode", "simulate"])
    from_environment.assert_called_once()
```

- [ ] **Step 4: Implement integration and run regressions**

Parse `--mode` with default `real`, plus `--enroll` and test-only/useful `--runtime-dir`. Retain current non-Windows real-mode failure before loading credentials. A source run uses `.env` through `from_environment`; a packaged/runtime-dir execution uses JSON and invokes enrollment when absent. Configure `%LOCALAPPDATA%\\WorkLens\\logs\\agent.log` in installed mode and pass its SQLite path into existing loops.

Run: `cd agent && python -m pytest tests/test_main.py tests/test_enrollment.py tests/test_client.py tests/test_queue.py tests/test_autocad.py tests/test_segmenter.py tests/test_simulator.py -v`

Expected: PASS. Commit message: `feat(agent): enroll installed Windows users`.

### Task 3: Windows executable and installer

**Files:**
- Create: `agent/requirements-build.txt`
- Create: `agent/scripts/build-windows.ps1`
- Create: `agent/installer/WorkLensAgent.iss`
- Create: `agent/installer/build-installer.ps1`
- Create: `agent/.gitignore`

**Interfaces:**
- Build script output: `agent/dist/WorkLensAgent/WorkLensAgent.exe`.
- Installer output: `agent/installer/output/WorkLensAgentSetup.exe`.

- [ ] **Step 1: Add build dependency and ignores**

Add `pyinstaller>=6.10,<7`. Ignore generated `build/`, `dist/`, `runtime-defaults.json`, `*.spec`, `data/`, and `.env` below `agent/`, but do not ignore scripts/docs.

- [ ] **Step 2: Implement the build script**

```powershell
param([Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$DefaultApiUrl)
$agentRoot = Split-Path -Parent $PSScriptRoot
$defaults = Join-Path $agentRoot 'build/runtime-defaults.json'
New-Item -ItemType Directory -Force (Split-Path -Parent $defaults) | Out-Null
@{ apiUrl = $DefaultApiUrl.TrimEnd('/') } | ConvertTo-Json | Set-Content -Path $defaults -Encoding utf8
Push-Location $agentRoot
python -m PyInstaller --noconfirm --clean --windowed --onedir --name WorkLensAgent --paths . --add-data "$defaults;worklens_agent" worklens_agent/main.py
Pop-Location
```

Install build requirements first. The generated defaults file contains only the non-secret API base URL.

- [ ] **Step 3: Implement Inno Setup and compiler script**

Inno fields: `AppName=WorkLens Agent`, `DefaultDirName={autopf}\\WorkLens Agent`, `OutputBaseFilename=WorkLensAgentSetup`, `UninstallDisplayName=WorkLens Agent`, `PrivilegesRequired=admin`. Copy the full onedir distribution. Add `{userstartup}` shortcut with `--mode real` and working directory `{localappdata}\\WorkLens`; add post-install `--enroll`; use `UninstallDelete` for `{localappdata}\\WorkLens`.

```powershell
param([string]$InnoSetupCompiler = "${env:ProgramFiles(x86)}\\Inno Setup 6\\ISCC.exe")
$agentRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $agentRoot 'dist/WorkLensAgent'
if (-not (Test-Path (Join-Path $source 'WorkLensAgent.exe'))) { throw 'Build WorkLensAgent.exe first.' }
& $InnoSetupCompiler "/DSourceDir=$source" "/O$(Join-Path $agentRoot 'installer/output')" (Join-Path $agentRoot 'installer/WorkLensAgent.iss')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

- [ ] **Step 4: Build on Windows and commit**

Run: `cd agent; .\scripts\build-windows.ps1 -DefaultApiUrl "https://workforce-activity-platform-lyart.vercel.app"; .\installer\build-installer.ps1`

Expected: both output executables exist and neither contains `.env` or a token. Commit message: `build(agent): add Windows installer pipeline`.

### Task 4: Documentation and acceptance evidence

**Files:**
- Modify: `agent/README.md`
- Create: `docs/worklens-agent-employee-installation.md`
- Create: `docs/worklens-agent-developer-guide.md`
- Create: `docs/worklens-agent-test-checklist.md`

- [ ] **Step 1: Write employee guide**

Document only normal UI actions: download/double-click installer, enrollment with manager-issued values, reboot/log-in automatic startup, data location, and Windows Apps uninstall. Explicitly say employees need no Python, terminal, `.env`, pip, PowerShell, or virtual environment.

- [ ] **Step 2: Write developer guide**

Document Windows prerequisites, build/install commands, existing real/simulate commands, `--enroll` token rotation, runtime logs/queue, API verification without storing credentials, and the secret-handling rule.

- [ ] **Step 3: Create the 20-item test checklist**

For each required test, state exact procedure, expected evidence, and status: `Automated local`, `Hosted preflight`, `Fresh Windows required`, or `Optional AutoCAD`. Include install/enroll, heartbeat/dashboard, foreground/title, DWG, idle, SQLite, offline/reconnect, persistence, idempotency, exit/relaunch, reboot/startup, manager/employee scope, uninstall, no-Python, and no-terminal checks.

- [ ] **Step 4: Run docs/tests and record evidence**

Run: `git diff --check && rg -n "worklens_agent_" docs agent/README.md`

Expected: no whitespace errors and no real token in tracked docs.

Run: `cd agent && python -m pytest -v`

Expected: all agent tests pass; record exact result. Then run the full installer checklist on a fresh Windows machine. Do not mark Windows-only checks passed from this host. Commit message: `docs(agent): add employee installation handoff`.

## Plan self-review

- Runtime persistence/configuration maps to Task 1; enrollment and interactive execution to Task 2; PyInstaller, Inno Setup, startup, and uninstall to Task 3; all requested documentation and validation to Task 4.
- Interfaces use the same `RuntimePaths`, `AgentConfig`, enrollment, and loop signatures across tasks.
- No task changes the collector or hosted API contract, and no secret appears in the plan.
