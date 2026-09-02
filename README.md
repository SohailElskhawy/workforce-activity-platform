# WorkLens
Workforce & Project Activity Tracking Platform

## Problem

Engineering teams often need a trustworthy view of project effort without requiring people to keep a second, manual activity log. WorkLens brings together project work, task assignments, manual time entries, and lightweight desktop activity signals in one role-aware dashboard.

## Demo Scope

This repository is a deterministic demo, not a production monitoring product. It includes a manager dashboard, employee self-service views, seeded projects and activity data, a protected agent ingestion API, and a Python simulator that drives that API.

## Architecture

```text
                         +---------------------+
                         |  Next.js Web App    |
                         |  manager + employee |
                         +----------+----------+
                                    |
                                    v
                         +---------------------+
                         | PostgreSQL / Prisma |
                         +---------------------+

 +---------------------+       HTTPS       +---------------------+
 | Windows Agent or    +------------------->| Agent API           |
 | Python Simulator    |                    | /api/agent/*        |
 +---------------------+                    +----------+----------+
                                                       |
                                                       v
                                             +---------------------+
                                             | PostgreSQL / Prisma |
                                             +---------------------+
```

The web application owns authentication and business data. The agent sends authenticated heartbeats and batches of activity segments to the Agent API; the API validates the registered device and writes idempotent activity rows to PostgreSQL.

## Core Features

- Manager dashboards for projects, employees, assignments, activity, and reports.
- Employee dashboards for their own projects, tasks, time entries, and activity.
- Deterministic demo seed with projects, mappings, devices, and recent activity.
- Manager-only device registration and token issuance.
- Agent batching, SQLite offline queue, and idempotent backend ingestion.
- Optional Windows foreground-window collection plus a platform-independent simulator.

## Tech Stack

- Next.js 16, React 19, NextAuth credentials sessions, and TypeScript.
- PostgreSQL with Prisma 7 migrations and seed data.
- Python 3.12+ agent using `httpx`, `psutil`, optional `pywin32`, and SQLite.
- Vercel is the intended Next.js host; use any managed PostgreSQL provider reachable from Vercel.

## Hosted Demo

No public deployment URL is configured in this checkout. To publish it, create a Vercel project with **Root Directory** set to `web`, deploy the `main` branch, and then replace this section with the canonical HTTPS URL.

The production database and Vercel account are intentionally not represented in the repository. Follow the deployment sequence in [Web Setup](#web-setup), then verify both demo accounts in a private browser window.

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Manager | `manager@worklens.demo` | `Demo1234!` |
| Employee | `employee@worklens.demo` | `z` |

The seed also creates the primary project `ABC AVM Electrical Project` and the `ABC_A_Block.dwg` file mapping. These are safe, deterministic demo records only.

## Repository Structure

```text
web/                 Next.js application, Prisma schema, migrations, and seed
agent/               Python desktop agent and simulator
docs/                product design and implementation notes
README.md            deployment and demo handoff
```

This repository intentionally uses npm rather than a pnpm workspace. The Vercel Root Directory is `web`, so web commands run from that directory.

## Web Setup

1. Install dependencies:

   ```bash
   cd web
   npm ci
   ```

2. Copy `.env.example` to `.env` and set the four required values. Do not commit `.env`.

   ```text
   DATABASE_URL
   AUTH_SECRET
   NEXTAUTH_URL
   AGENT_TOKEN_PEPPER
   ```

3. For local development, apply migrations and create the deterministic demo data:

   ```bash
   npm run db:deploy
   npm run db:seed
   npm run dev
   ```

For production, create a managed PostgreSQL database and use a production-only `DATABASE_URL`. Generate separate high-entropy `AUTH_SECRET` and `AGENT_TOKEN_PEPPER` values; set `NEXTAUTH_URL` to the exact canonical HTTPS deployment URL. In Vercel, set all four variables for the Production environment, use `npm ci` as the install command and `npm run build` as the build command, then run the migration and seed commands once from a trusted environment that has the production `DATABASE_URL`.

After deployment, use a private or incognito browser to verify: manager login reaches the manager dashboard; employee login reaches the employee dashboard; logout returns to `/login`.

## Desktop Agent

See [agent/README.md](agent/README.md) for Python setup, manager device registration, environment variables, simulator mode, Windows mode, privacy behavior, and the offline queue.

## Simulator Mode

The simulator is not a mock API. It uses the same authentication headers, heartbeat endpoint, SQLite queue, batch upload endpoint, validation, idempotency rules, and PostgreSQL persistence path as the Windows agent. Configure it with a registered device and run:

```bash
cd agent
python -m worklens_agent.main --mode simulate
```

## Activity Pipeline

1. The Windows collector observes only the foreground window, or the simulator emits a deterministic sequence.
2. The segmenter turns unchanged observations into bounded activity segments and closes segments on state changes.
3. The queue stores segments locally before upload.
4. The agent sends heartbeats and activity batches with a bearer token and device ID.
5. The Agent API authenticates the active device, validates the batch, resolves mappings, and persists activity for dashboard/report queries.

## Offline Queue and Idempotency

The agent stores pending segments in `agent/data/activity.db` until a successful upload response. Failed network requests remain queued and are retried on the next upload cycle. Each segment has an event ID; the database unique constraint on `(deviceId, eventId)` makes backend ingestion idempotent, so retries do not create duplicate activities.

## AutoCAD/DWG Strategy

For AutoCAD foreground windows, the Windows collector extracts a DWG filename when it appears in the window title. The backend matches normalized filenames to manager-maintained file mappings, for example `ABC_A_Block.dwg`, and associates matching activity with the mapped project and task. WorkLens does not inspect DWG contents or files on disk.

## Security and Privacy

- Production secrets belong only in the managed host and database environment settings; never commit, document, screenshot, or seed them.
- Passwords and registered agent tokens are stored as hashes; a newly issued raw agent token is shown only at registration time.
- Agent API requests require both `Authorization: Bearer <token>` and `X-Device-ID`; inactive devices are rejected.
- The collector records foreground application/process/window metadata and optional DWG filename, not keystrokes, screenshots, document contents, or network traffic.
- Configure sensitive applications in `WORKLENS_EXCLUDED_PROCESSES`; excluded foreground windows produce no activity segment.
- Manager and employee routes enforce role and tenant scope.

## Known Limitations

- This checkout has no linked Vercel project, managed PostgreSQL instance, or public hosted URL. Provisioning and production verification require the owner’s cloud accounts.
- Device registration is currently a manager-protected API endpoint; there is no dedicated registration screen in the web UI.
- The real collector is Windows-only and observes the foreground window at a fixed interval. It does not capture lock/unlock events directly.
- The local SQLite queue is intentionally simple: it has no encryption at rest, background service installer, or automated update channel.
- The demo seed resets the demo company on each run. Run it only against an isolated demo database, never against real customer data.

## Future Improvements

- Add a manager device-registration UI with one-time token display and revocation.
- Add agent packaging, Windows service management, encrypted local storage, and automatic updates.
- Add configurable retention, consent workflows, export controls, and organization-specific privacy policies.
- Add production deployment automation that runs migrations safely and blocks duplicate seeding.
- Add broader OS support and richer, policy-controlled project-file integrations.
