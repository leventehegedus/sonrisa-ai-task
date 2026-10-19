### Task 10: Admin routes and server entry point

**Files:**
- Create: `server/src/http/admin-routes.ts`, `server/src/main.ts`
- Modify: `server/src/http/app.ts` (register admin routes), `server/package.json` (`dev: tsx watch src/main.ts`, `start: tsx src/main.ts`)
- Test: `server/test/api-admin.test.ts`

**Interfaces:**
- Routes (all `requireAdmin`), from design §11:
  - `GET /api/admin/users`, `/rules`
  - `GET /api/admin/events?limit=` (default 100, max 500)
  - `GET /api/admin/deliveries?status=`, and `POST /api/admin/deliveries/:id/retry`, which sets `pending`, `attempts 0`, `next_attempt_at now`, and `409` if it isn't `failed`
  - `GET /api/admin/sources`, `PATCH /api/admin/sources/:id` with `{ enabled?, poll_interval_s? (60..86400) }`, and `POST /api/admin/sources/:id/poll`, which calls `pollSource` and returns its result
  - `POST /api/admin/events`, which takes `ManualEventInput`, calls `ingest([manualEvent(...)])`, and returns `{ event, deliveriesCreated }`
- `main.ts`: `openDb(process.env.DB_PATH ?? 'data/alerts.db')`, `seed`, `createChannelRegistry` from env (`SMTP_URL`, `SLACK_DRY_RUN` default `'1'`, outbox `data/outbox`), `buildApp`, `startScheduler`, then listen on `PORT ?? 3000`.

- [ ] **Step 1: Write the failing tests:**
  - A non-admin gets 403 on every admin route.
  - Inject a HU severity-0.6 event → `deliveriesCreated` 2 (Anna and Bence), and 0 for Priya.
  - Inject Red severity 1.0 in country NP → all 3 users get one.
  - Retry on a `sent` delivery → 409; on a `failed` one → `pending`.
  - PATCH a source with `poll_interval_s: 5` → 400.
  - `POST /sources/:id/poll` with a stub fetch → `ok: true`.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Manual check:** `npm run dev -w server`, then `curl -s localhost:3000/api/me -H 'X-User-Id: 1'` returns Anna. Within about 10 s, `curl -s localhost:3000/api/admin/sources -H 'X-User-Id: 1'` shows `last_polled_at` set on every source, and any `last_error` is understood. Paste the output into `docs/evidence/m2-api-smoke.md`.
- [ ] **Step 6: Commit** `feat(api): admin routes, manual inject, server entry`
- [ ] **Step 7: Milestone gate M2** (as in M1) on `feat/api`.

