# WorkLens

**Workforce & Project Activity Tracking Platform**

WorkLens is an activity tracking and project management platform designed for engineering and design consultancies. It seamlessly combines project and task assignment, manual time tracking, and background Windows desktop activity telemetry to provide clear, actionable insights into project effort—particularly AutoCAD/DWG design work—without invasive monitoring.

---

## Architecture Overview

```text
                               +-----------------------------+
                               |     Next.js 16 Web App      |
                               |    (Manager & Employee)     |
                               +--------------+--------------+
                                              |
                                              v
                               +-----------------------------+
                               |     PostgreSQL / Prisma     |
                               +-----------------------------+
                                              ^
                                              |
   +------------------------------+           |
   |     Windows Desktop Agent    |    HTTPS  |
   | (Win32 Collector + Segmenter)|-----------+
   | (DPAPI Encrypted Credentials)|   /api/agent/*
   | (SQLite Queue + Auto-Prune)  |
   +------------------------------+
```

1. **Manager & Employee Web Application**: Next.js 16 (React 19, TypeScript, Tailwind CSS, Shadcn UI) providing role-based workspaces for managers (projects, tasks, employees, devices, manual time, DWG reports) and employees (tasks, time tracking, personal timeline).
2. **PostgreSQL Database**: Relational schema managed with Prisma 7 migrations, featuring strict tenant isolation and composite query indexes.
3. **Windows Desktop Agent**: Lightweight Python agent compiled to a standalone executable via PyInstaller and packaged with Inno Setup. Runs unobtrusively in the user session, securely storing credentials using Windows DPAPI, logging active application titles and DWG filenames, caching offline activity in SQLite, and uploading batches idempotently.

---

## Privacy Commitments

WorkLens is built on the principle of non-invasive, task-relevant telemetry. **WorkLens V1 does NOT collect**:

* ❌ Keystrokes or keylogging
* ❌ Passwords or credential fields
* ❌ Screenshots or screen grabs
* ❌ Continuous screen video recording
* ❌ Clipboard contents
* ❌ File contents or CAD drawing data from disk
* ❌ Network browsing content or message body text

**What WorkLens DOES collect**:
* Foreground window title and process name (e.g. `AutoCAD - ABC_A_Block.dwg`, `Google Chrome`)
* Active application time vs. user idle time (based on keyboard/mouse inactivity threshold, default 300s)
* Extracted DWG filename for AutoCAD windows to map effort to projects and tasks
* Configured process exclusions: processes listed in `excludedProcesses` (e.g. `keepass.exe`, `1password.exe`) are completely omitted from collection.

---

## Web Setup & Production Deployment

### Prerequisites
* Node.js 20+ LTS
* PostgreSQL 15+ database

### Environment Variables
Configure the following in your deployment environment (e.g., Vercel, Docker, or Linux VM):

| Variable | Description | Required |
|---|---|:---:|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`) | Yes |
| `AUTH_SECRET` | 32+ byte cryptographic secret for NextAuth sessions (`openssl rand -base64 32`) | Yes (enforced in prod) |
| `NEXTAUTH_URL` | Canonical HTTPS URL of the deployed web application (e.g. `https://worklens.yourcompany.com`) | Yes |
| `AGENT_TOKEN_PEPPER` | Secret pepper used to HMAC agent device tokens before storage (`openssl rand -base64 32`) | Yes (fails fast if missing) |

### Database Migrations
Always deploy database schema updates using Prisma's migration runner:

```bash
cd web
npm ci
npx prisma migrate deploy
```
*(Do not use `prisma db push` or destructive reset commands in production).*

### Initial Clean Client Setup (Bootstrap)
To initialize a fresh production database with a new company and initial manager account without seeding demo data:

```bash
cd web
npx tsx scripts/bootstrap-company.ts \
  --company "Your Company Name" \
  --email "manager@yourcompany.com" \
  --password "SecurePassword123!" \
  --first "Firstname" \
  --last "Lastname"
```
Or set `BOOTSTRAP_COMPANY_NAME`, `BOOTSTRAP_MANAGER_EMAIL`, and `BOOTSTRAP_MANAGER_PASSWORD` and run:
```bash
npm run db:bootstrap
```

Once bootstrapped, navigate to `/login` to access the manager portal.

*(Optional Demo Seed: For local evaluation only, `npm run db:seed` will populate sample projects and demo employees under "WorkLens Demo Engineering".)*

---

## Manager Portal Operations

1. **Employee Management (`/employees`)**:
   - Create new employees with company email, department, position, and temporary login credentials.
   - Edit employee profiles or change status (`ACTIVE`, `INACTIVE`, `SUSPENDED`). Deactivating an employee automatically revokes all associated hardware devices.
2. **Project & Task Management (`/projects`, `/tasks`)**:
   - Create projects with unique project codes, estimated hours, and planned start/end dates.
   - Create tasks under projects with priorities (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), due dates, and assign team members.
   - Update task status (`TODO`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `COMPLETED`, `CANCELLED`).
3. **Device Registration & Revocation**:
   - On an employee's profile page (`/employees/[id]`), click **"Register Agent Device"** to issue a new hardware device identity and secure one-time agent token.
   - Hand the `Device ID` and `Device Token` to the employee or deployment technician.
   - View device status (Online/Offline indicator, agent version, last seen timestamp).
   - If an employee leaves or a computer is lost, click **"Revoke Access"** to immediately block future agent heartbeats and uploads.
4. **AutoCAD & DWG Reports (`/reports/dwg`)**:
   - Track active engineering minutes spent in AutoCAD per DWG file, broken down by employee, project, and task.
   - View unmapped DWG files, view accumulated time, and map them to the correct project and task.

---

## Windows Desktop Agent Runbook

### Build Installer
To build the Windows executable and setup installer:

```powershell
# In agent/
cd agent

# 1. Build PyInstaller binary
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1 -DefaultApiUrl "https://worklens.yourcompany.com"

# 2. Build Inno Setup installer
powershell -ExecutionPolicy Bypass -File installer/build-installer.ps1
```
The output installer is generated at `agent/installer/output/WorkLensAgentSetup.exe`.

### Installation & Enrollment
1. Run `WorkLensAgentSetup.exe` on the employee's Windows machine.
2. The installer creates program files in `C:\Program Files (x86)\WorkLens Agent` and a startup shortcut in `{userstartup}` so the agent starts automatically upon Windows login.
3. Upon first run (or via the **"Configure WorkLens Agent"** shortcut), the enrollment dialog appears:
   - **Hosted API URL**: `https://worklens.yourcompany.com`
   - **Device ID**: Provided by manager (e.g. `WS-ENG-001`)
   - **Device Token**: One-time secret token generated during device registration.
4. Clicking **"Enroll"** tests connection with the server, verifies credentials via heartbeat, and securely writes configuration.

### Local Agent File Locations
* **Configuration**: `%LOCALAPPDATA%\WorkLens\config.json`
* **Secure Token Storage**: The agent token is encrypted on disk using **Windows DPAPI** (`CryptProtectData`). Raw secrets are never saved in plaintext. Any legacy configuration with plaintext tokens is automatically migrated and re-encrypted on startup.
* **SQLite Offline Queue**: `%LOCALAPPDATA%\WorkLens\activity.db`
* **Rotating Logs**: `%LOCALAPPDATA%\WorkLens\logs\agent.log` (5 MB per file, 3 backups, max 20 MB).

### Verifying Agent Health & Status
Technicians or users can check agent operational health at any time:

```powershell
# Run the status command
& "C:\Program Files (x86)\WorkLens Agent\WorkLensAgent.exe" --status
```
Example Output:
```text
=== WorkLens Agent Status ===
Runtime Root: C:\Users\employee\AppData\Local\WorkLens
Log File:     C:\Users\employee\AppData\Local\WorkLens\logs\agent.log
Database:     C:\Users\employee\AppData\Local\WorkLens\activity.db
Device ID:    WS-ENG-001
API URL:      https://worklens.yourcompany.com
Version:      0.1.0
Local Queue:  0 pending segment(s)
Status:       CONNECTED (Online)
=============================
```

### Offline Queue & Automatic Pruning
* When the user is offline or the company network drops, activity collection continues locally in `activity.db`.
* Once connectivity returns, queued records upload in chronological batches.
* **Safe Pruning**: Successfully uploaded activities older than **7 days** are automatically pruned on startup and periodically every hour. **Pending/unuploaded records are NEVER pruned** under any condition, guaranteeing zero data loss during prolonged offline periods.

---

## AutoCAD Project-Time Pipeline

```text
AutoCAD Active Window
  (acad.exe, title: "ABC_A_Block.dwg")
       │
       ▼
Filename Extraction & Normalization
  (normalizeFileName -> "abc_a_block.dwg")
       │
       ▼
Activity Segment Created (Type: APPLICATION)
  (Idle time excluded; duration recorded)
       │
       ▼
Batch Ingestion & File Mapping Resolution
  (Matches Company FileMapping table)
       │
       ├─► If Mapped: Associates with Project & Task automatically
       │
       └─► If Unmapped: Stored with fileName for Manager Mapping
               │
               ▼
       Manager maps DWG in UI
               │
               ▼
       Retroactive Update
         (Updates all matching past activity rows for that company)
               │
               ▼
       Manager AutoCAD Report
         (Aggregates active minutes by Engineer, DWG, Project, Task)
```

**Timezone Handling**: All activity boundaries, timeline displays, and DWG aggregation reports use `Europe/Istanbul` (UTC+3) calendar day bounds (00:00:00 to 24:00:00 local time).

---

## Known Limitations

1. **Foreground Window Focus**: WorkLens monitors only the currently active foreground window on the primary user session. Background applications running on secondary monitors without user focus are marked inactive or idle.
2. **Multi-User / Terminal Server**: Designed for single-user desktop workstations. Multi-session Remote Desktop Server environments require separate per-user agent processes.
3. **AutoCAD Title Conventions**: The agent extracts filenames formatted in standard AutoCAD window title formats (`filename.dwg`, `[filename.dwg]`, etc.). Custom third-party title modifiers that strip the `.dwg` extension will prevent automatic DWG extraction.
4. **Inno Setup Build Dependency**: Compiling the `.iss` installer requires Inno Setup 6 (`ISCC.exe`) installed on the build machine. The PyInstaller executable can be built independently on any Windows machine with Python 3.12+.

---

## Client Delivery Verification

Refer to [docs/CLIENT_DELIVERY_CHECKLIST.md](docs/CLIENT_DELIVERY_CHECKLIST.md) for the sign-off checklist and pre-flight verification steps.
