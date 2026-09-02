# WorkLens Agent packaging demo checklist

Use a manager-issued demo device and the hosted HTTPS application. Record the tester, Windows version, installer version, timestamp, and dashboard screenshots/IDs alongside this checklist. Never record the raw device token.

| # | Test and procedure | Expected evidence | Current status |
| --- | --- | --- | --- |
| 1 | On a clean Windows machine, run `WorkLensAgentSetup.exe`. | Normal installer completes and Apps lists WorkLens Agent. | Fresh Windows required |
| 2 | Complete installer/enrollment and inspect Task Manager. | `WorkLensAgent.exe` is running in the employee session. | Fresh Windows required |
| 3 | Enroll using a valid hosted URL/device/token. | Enrollment succeeds; hosted heartbeat is accepted. | Hosted preflight: heartbeat HTTP 200 |
| 4 | Open the manager dashboard after enrollment. | Device heartbeat/last-seen timestamp is visible. | Fresh Windows dashboard check required |
| 5 | Put a non-excluded application in the foreground for at least one collection interval, then switch app. | Application event uploads. | Fresh Windows required |
| 6 | Use a distinctive window title in the foreground test. | Uploaded activity retains the title. | Fresh Windows required |
| 7 | If AutoCAD is installed, foreground a `.dwg` drawing. | Uploaded AutoCAD activity includes the DWG filename and mapping when configured. | Optional AutoCAD / Fresh Windows required |
| 8 | Leave the machine idle beyond configured threshold, then resume. | An `IDLE` segment is queued/uploaded. | Fresh Windows required |
| 9 | Inspect `%LOCALAPPDATA%\WorkLens\activity.db` after an activity state change. | SQLite pending queue contains activity before successful delivery. | Fresh Windows required |
| 10 | Disconnect internet while activity changes occur. | Collection continues and queue grows; no data loss/crash. | Fresh Windows required |
| 11 | Restore internet after test 10. | Queued activities upload and pending rows are marked uploaded. | Fresh Windows required |
| 12 | Stop the process with pending activity, then relaunch it. | Unsent rows survive and later upload. | Fresh Windows required |
| 13 | Cause/repeat an upload retry with the same event IDs. | Hosted API does not create duplicate activity. | Fresh Windows required |
| 14 | Exit the process, then launch it again. | Agent starts cleanly and resumes collection. | Fresh Windows required |
| 15 | Log out/reboot/log in as the enrolled employee. | Startup shortcut launches real-mode agent without re-enrollment. | Fresh Windows required |
| 16 | Generate new activity and inspect manager dashboard. | New activity is visible for the device’s employee. | Fresh Windows required |
| 17 | Sign in as that employee and open My Activity. | Only that employee’s activity is shown. | Fresh Windows required |
| 18 | Uninstall through Windows Apps/Installed Programs. | App and Startup shortcut are gone; `%LOCALAPPDATA%\WorkLens` is deleted. | Fresh Windows required |
| 19 | Repeat clean install on a machine with no Python installation. | Installer and agent work with no Python/pip/venv. | Fresh Windows required |
| 20 | Give an ordinary employee only the installer and manager credentials. | Completion requires no terminal command or `.env`. | Fresh Windows required |
| 21 | As a manager, select **Add employee**, create a unique work email and temporary password, then sign in as that employee. | New employee appears as `NOT ENROLLED`; linked employee login succeeds; manager can register that employee's device. | Fresh hosted-app check required |

## Executed preflight

- Hosted `POST /api/agent/heartbeat` with the supplied demo device accepted the existing authentication contract with HTTP 200 on 2026-09-02.
- Hosted `POST /api/agent/activities/batch` accepted a UUID-formatted activity payload with HTTP 200 and `accepted: 1` on 2026-09-02.
- A deliberately non-UUID event ID returned HTTP 400 `Invalid UUID`, confirming server-side event validation rather than a packaging issue.
- The complete 27-test agent suite ran through the available standard-library runner with temporary compatibility shims for unavailable `python-dotenv` and `httpx`; runtime-path, JSON-configuration, enrollment-persistence, HTTPS enrollment validation, installed-main selection, queue, client, simulator, segmenter, and DWG tests passed. The host does not provide pytest/pip/venv and cannot execute the Windows installer.

## Known demo limitations

- The installer does not provide auto-update, MSI, Intune, Group Policy, or enterprise deployment.
- Manager registration/token issuance still uses the existing manager-protected API flow; no manager registration screen is added here.
- Runtime `config.json` uses Windows profile access controls but is not DPAPI-encrypted.
- A full system-tray UI is intentionally not included; installer, startup, persistence, and collection reliability take precedence.
