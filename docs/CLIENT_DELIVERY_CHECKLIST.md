# WorkLens V1 Client Delivery Checklist

This checklist tracks production readiness and deployment verification for WorkLens V1. Every item must be verified prior to signing off on a client deployment.

---

## 1. Web & Cloud Infrastructure

- [x] **Production URL working**: Verified HTTPS deployment URL is live and accepting traffic.
- [x] **Database migration applied**: Production schema deployed via `npx prisma migrate deploy` (no `db push`).
- [x] **Required environment variables configured**:
  - `DATABASE_URL`: PostgreSQL connection string.
  - `AUTH_SECRET`: High-entropy 32-byte secret (enforced in production).
  - `NEXTAUTH_URL`: Canonical HTTPS URL.
  - `AGENT_TOKEN_PEPPER`: Secret HMAC pepper for agent device tokens (fail-fast enforced).
- [x] **No committed secrets**: Git repository audited; `.env*` files gitignored, no private keys or tokens committed.

---

## 2. Authentication & Access Control

- [x] **Initial Company Bootstrap**: Safe client bootstrap via `npm run db:bootstrap` (no demo seed data required).
- [x] **Manager login works**: Managers authenticate, access `/dashboard`, and manage company resources.
- [x] **Employee login works**: Employees authenticate, view their assigned tasks and submit manual time.
- [x] **RBAC & Multi-tenant isolation**:
  - Managers cannot access other companies' resources.
  - Employees cannot view manager management routes or another employee's timeline.

---

## 3. Windows Desktop Agent

- [x] **Agent installer built**: `WorkLensAgentSetup.exe` packaged with portable relative paths (no developer machine paths).
- [x] **Fresh installer tested**: Clean installation into `%ProgramFiles(x86)%\WorkLens Agent` or local app data.
- [x] **Enrollment tested**: GUI enrollment dialog prompts for Server URL, Device ID, and Device Token.
- [x] **Secure Token Storage**: Raw token is encrypted at rest using Windows DPAPI (`CryptProtectData`); zero plaintext secrets on disk.
- [x] **Legacy migration tested**: Existing plaintext `config.json` automatically migrated to DPAPI on startup.
- [x] **Startup tested**: Startup shortcut created in `{userstartup}` with resilient network-independent boot.
- [x] **Operational status visibility**: `WorkLensAgent.exe --status` displays live connection, device ID, queue depth, and log paths.
- [x] **Heartbeat visible**: Agent sends periodic heartbeat; manager UI displays "Online" within 3 minutes of activity.
- [x] **Offline queue tested**:
  - When disconnected from the internet, activity accumulates safely in `%LOCALAPPDATA%\WorkLens\activity.db`.
  - On reconnection, queued batches upload in order with deduplication via `(deviceId, eventId)` uniqueness.
- [x] **Safe Queue Pruning**:
  - Successfully uploaded records older than 7 days are automatically pruned.
  - Pending/unuploaded records are NEVER pruned under any condition.
- [x] **Device revocation tested**: Manager revoking a device immediately causes the backend to return HTTP 401; agent handles 401 gracefully without crash loops.

---

## 4. AutoCAD & Time Tracking

- [x] **AutoCAD DWG detection tested**: Window titles matching AutoCAD patterns extract clean `.dwg` filenames.
- [x] **Timezone correctness**: Activity timeline and reporting boundaries calculate accurately using `Europe/Istanbul` (00:00 to 24:00 local time).
- [x] **DWG duration aggregation**: Sums active APPLICATION time per DWG file; excludes IDLE and non-AutoCAD processes.
- [x] **DWG mapping tested**:
  - Manager views unmapped DWG files with employee, first seen, last seen, and accumulated duration.
  - Mapping a DWG to a project/task retroactively updates existing company activity rows.
- [x] **AutoCAD report tested**: Manager report displays DWG breakdown by employee, project, task, and duration.
- [x] **Manual time management**: Employees can log, edit, and delete time entries with self-overlap prevention.

---

## 5. Documentation & Privacy

- [x] **README updated**: Comprehensive architecture, deployment, enrollment, and operational runbook.
- [x] **Privacy guarantees documented**: Explicit client disclosure that WorkLens does NOT record keystrokes, passwords, screenshots, clipboard content, or video.
- [x] **Known limitations documented**: Clear boundaries on single-monitor focus tracking, multi-user Windows sessions, and offline queue caps.
