# AGENTS.md

## Project
WorkLens / SODA Workforce & Project Tracking Platform.

Current target: **finish the full remaining project scope in 4 days**.

## Source of Truth
Use the release docs and the original requirements as the implementation basis:

- `docs/releases/v1-completion/00-release-overview.md`
- `docs/releases/v1-completion/01-requirements-and-scope.md`
- `docs/releases/v1-completion/02-ui-ux-specification.md`
- `docs/releases/v1-completion/03-technical-design.md`
- `docs/releases/v1-completion/04-implementation-plan.md`
- `docs/releases/v1-completion/05-testing-and-acceptance.md`
- Original `SODA MANAGEMENT.pdf`

Do not re-plan the whole project for every task. Implement the requested vertical slice.

## Scope
All remaining requirements are in scope for this 4-day completion release, including:

- UI/UX optimization
- Departments
- Super Admin
- Tracking settings
- Excluded applications
- Configurable idle threshold
- Computer lock/unlock
- Agent tray/status UI
- Manual time editing
- Audit coverage
- Full filtering/reporting
- Notifications
- Excel/CSV export
- ClickUp integration
- Kolay İK integration
- Clockify import/integration
- Automatic DWG/project matching
- Advanced anomaly detection
- Advanced reporting
- AI reporting
- Workload analysis
- Predictions
- Automatic classification
- Management recommendations
- Final installer, deployment, and hardening

If time pressure requires simplification, prefer a complete, reliable vertical slice over a broad but broken implementation. Do not silently remove features from scope.

## Engineering Rules
- Inspect existing code before changing architecture.
- Reuse existing components, APIs, schema, and patterns where reasonable.
- Avoid unrelated refactors.
- Avoid new dependencies unless necessary.
- Do not remove working functionality.
- Keep manager, employee, and super-admin permissions separate.
- Enforce tenant/company isolation server-side.
- Validate all mutations server-side.
- Never trust client- or agent-supplied ownership.
- Keep manual time and automated activity separate.
- Audit important mutations.
- Never expose secrets, raw agent tokens, or sensitive data in logs.

## UI/UX
Use existing Tailwind/shadcn patterns.

Prefer:
- consistent AppShell/navigation
- clear page headers
- predictable primary actions
- reusable tables/filter bars
- status badges
- loading, empty, error, and success states
- responsive layouts
- simple forms/dialogs

Optimize for clarity and ease of use.

## Desktop Agent
- Preserve local queue + batch upload.
- Do not send activity every second.
- Keep heartbeat lightweight.
- Use `configVersion` for tracking config changes.
- Excluded apps must not expose sensitive window titles/files.
- Lock/unlock should be state-change events.
- Preserve offline retry/idempotency.
- Do not add keylogging, screenshots, clipboard capture, or similar surveillance.

## Integrations
- Keep external IDs and sync mappings explicit.
- Make imports/sync idempotent.
- Prefer one-way sync first if two-way sync is risky.
- Never overwrite local data silently on integration conflicts.
- Log sync/import failures clearly.

## AI / Analytics
- Base AI outputs on stored platform data.
- Do not invent activity, project, or employee facts.
- Keep anomaly language neutral and review-oriented.
- Separate deterministic calculations from AI-generated interpretation.

## Testing
For each task:
1. Run relevant tests.
2. Run typecheck/lint if available.
3. Test authorization and tenant isolation.
4. Test validation and edge cases.
5. Check affected routes for regressions.

A feature is not complete when only the UI exists.

## Working Style
For each assigned task:
1. Inspect.
2. Implement the smallest coherent solution.
3. Test.
4. Fix regressions.
5. Report briefly:
   - what changed
   - important files changed
   - tests run
   - blockers or remaining issues

Do not silently defer project requirements. If a requirement must be simplified because of the 4-day deadline, implement the safest usable version and document the limitation.
