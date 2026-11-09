# Redion Hub

One private panel for Redi: every platform's assistant (BauFlow, BaumdienstFlow,
KiDraht, FindBar…) reports here what customers miss, bugs they report,
how-to questions the app guide could not answer, and system errors.
Installable as a PWA with phone push notifications.

- `POST /api/signals` with `Authorization: Bearer <platform key>`; body
  `{platform, externalId, company:{id,name}, kind: feature|bug|question|error,
  title, details, count, actor:{kind,name}, language, firstSeenAt, lastSeenAt}`.
  A repeat (same key + externalId) updates the count; a handled one comes back
  as new when it repeats.
- Panel `/`: password login, tabs Të hapura / Te agjenti / Të kryera / Të hequra.
  "Dërgoje te agjenti" stores Redi's instruction and copies a ready task prompt
  (repo, customer, what, how often) to paste into Claude/Codex.
- Agents: `GET /api/agent/tasks` and `POST /api/agent/tasks/:id/done {result}`
  with `Authorization: Bearer $HUB_AGENT_KEY`.

## Railway

Service `redion-hub`, Root Directory `/ops/redion-hub`, Dockerfile, volume at
`/data` (SQLite). Variables: `HUB_PASSWORD`, `HUB_PLATFORM_KEYS`
(`bauflow=<key>,kidraht=<key>`), `HUB_AGENT_KEY`, optional `HUB_REPOS`
(`platform=owner/repo`). VAPID keys and the session secret are generated on
first start and kept in the database.

A platform sends with `REDION_HUB_URL=https://<hub domain>` and
`REDION_HUB_KEY=<its key>`.

Tests: `npm test` (Node 22 built-in runner).
