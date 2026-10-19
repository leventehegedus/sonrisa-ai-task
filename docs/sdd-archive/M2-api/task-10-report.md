# Task 10 report: Admin routes and server entry point

**Status:** DONE. Commit `fff5f8a feat(api): admin routes, manual inject, server entry` on `feat/api`. I did not run the milestone gate; that is the controller's step.

## What I built
- `server/src/http/admin-routes.ts` (88 lines). The admin plugin is registered under `/api/admin` and gates every route with `requireAdmin` in its own `onRequest` hook.
- `server/src/http/app.ts`: identity resolution (`authenticate`) now runs in an `onRequest` hook instead of `preHandler`. Fastify runs `onRequest` before it parses the body, so an unknown caller sending malformed JSON gets 401, not 400. The admin plugin is registered here too.
- `server/src/db/rows.ts`: adds the `rowToSource` mapper (R-P5) and `DELIVERY_EVENT_COLUMNS`, the shared `e_*` select list that both `/my/deliveries` and `/admin/deliveries` use with `rowToDeliveryWithEvent`.
- `server/src/http/user-routes.ts`: `IdParams` and `notFound` are now exported so the admin routes can reuse them. The deliveries SQL uses `DELIVERY_EVENT_COLUMNS`. Behavior is unchanged.
- `server/src/main.ts` reads its config from env:
  - `PORT` (default 3000).
  - `DB_PATH` (default `data/alerts.db`); its directory is created if missing.
  - `SMTP_URL`.
  - `SLACK_DRY_RUN` (default `'1'`; anything other than `'0'` means dry run).
  - `SEED_SLACK_WEBHOOK`, passed to `seed()`.
  - The outbox is always `data/outbox`.

  It then builds the channel registry, calls `buildApp` and `startScheduler`, and listens on `127.0.0.1` (marked with a `shortcut:` comment: header identity is not auth). It logs `World Alerts API on http://127.0.0.1:<port>`. On SIGINT/SIGTERM it stops the scheduler, awaits `app.close()`, calls `db.close()` and exits 0.
- `server/package.json`: `dev: tsx watch src/main.ts` (this replaces the stale `src/index.ts`) and `start: tsx src/main.ts`.
- `server/test/api-admin.test.ts`: 37 tests.
- `docs/evidence/m2-api-smoke.md`: the real smoke check.

## Routes
Every route returns 401 for an unknown caller and 403 `{error:'admin only'}` for a non-admin.

| Route | Success | Errors |
|---|---|---|
| GET /api/admin/users | 200 users (no channel data) | |
| GET /api/admin/rules | 200 every user's rules, including userId | |
| GET /api/admin/events?limit= | 200 newest first (default 100) | 400 if limit is not an int in 1..500 |
| POST /api/admin/events | 201 `{event, deliveriesCreated}` | 400 (strict `ManualEventInput`, unknown keys rejected) |
| GET /api/admin/deliveries?status= | 200, same shape as /my/deliveries plus `userId` (rule owner, falling back to channel owner) and no channel config. Newest 500 (`shortcut:`) | 400 for an unknown status |
| POST /api/admin/deliveries/:id/retry | 200 delivery (`pending`, attempts 0, next_attempt_at now, last_error null) | 409 `{error:'only failed deliveries can be retried'}`, 404, 400 bad id |
| GET /api/admin/sources | 200 `{id,type,name,config,enabled,pollIntervalS,lastPolledAt,lastError,baselineAt}` | |
| PATCH /api/admin/sources/:id | 200 source | 400 (strict; `poll_interval_s` must be an int in 60..86400; at least one field), 404 |
| POST /api/admin/sources/:id/poll | 200 `pollSource` result, even when `ok:false`; polls even a disabled source | 404 |

A retry is one conditional `UPDATE … WHERE status='failed'`. If it changes no row, a lookup decides between 409 and 404, so there is no read-then-write race.

## Tests and TDD evidence
The RED run used a stub `adminRoutes` that registered no routes, with auth still in `preHandler`. Result: `Tests  35 failed | 2 passed (37)`. Assertion failures included:
- `GET /api/admin/users → 403 for a non-admin` failed with `AssertionError: expected 404 to be 403`.
- `no X-User-Id with a malformed JSON body → 401, not 400` failed with `AssertionError: expected 400 to be 401`.
- `HU severity 0.6 → Anna and Bence…` failed with `AssertionError: expected 404 to be 201`.
- `Red severity 1.0 in NP…` failed with `AssertionError: expected undefined to be 3`.
- `retry on a sent delivery → 409` failed with `AssertionError: expected 404 to be 409`.
- `PATCH updates enabled and poll_interval_s` failed with `AssertionError: expected 404 to be 200`.

The 2 tests that passed during RED were "known user with a malformed body → 400" (already true) and one other.

GREEN, admin and user API tests together: `Test Files  2 passed (2)` / `Tests  69 passed (69)`.

The tests cover these brief items:
- 403 on all 9 routes, with nothing fetched or written.
- HU 0.6 creates 2 deliveries (Anna and Bence), none for Priya.
- NP 1.0 creates 3 deliveries, with `override` true.
- Retry: `sent` and `pending` return 409 and leave the row unchanged; `failed` becomes `pending` with the DB row checked; unknown id returns 404.
- PATCH with `poll_interval_s: 5` returns 400. So do above 86400, non-integer, empty body and unknown key.
- Poll with a stub fetch returning `ok:true` on the Telex fixture: the source was disabled and still got polled, with `lastPolledAt` and `baselineAt` set. A bad config gives 200 `ok:false`.
- Inject rejects unknown key, unknown country, severity out of range, blank title and unknown category.
- Seeding with a Slack webhook leaves no trace of it in the `/admin/deliveries` body.
- Events: default and `limit` handling.
- The 401-before-body-parse case.

## Typecheck and suite
- `npm run typecheck -w server` printed `> tsc --noEmit` with no errors.
- `npm test -w server` printed `Test Files  13 passed (13)` / `Tests  212 passed (212)`. All existing api-user tests still pass after the `onRequest` change.

## Smoke check
This ran against a real server and the real network, with a temp DB on port 3999; details are in `docs/evidence/m2-api-smoke.md`.
- `/api/me` returned Anna.
- After about 15 s, all 5 sources had `lastPolledAt` and `baselineAt` set and `lastError: null`. Every feed was reachable, and the baseline polls stored 362 events.
- Injecting a HU 0.6 event returned `deliveriesCreated: 2`. After one dispatcher tick both deliveries were `sent` (email outbox) with `userId` 1 and 2.
- A non-admin got 403.
- SIGTERM shut the server down cleanly: no process was left and port 3999 was free.
- The outbox files landed in `server/data/outbox/`, which is gitignored.

## Files changed
- `server/src/http/admin-routes.ts` (new)
- `server/src/main.ts` (new)
- `server/test/api-admin.test.ts` (new)
- `server/src/http/app.ts`
- `server/src/http/user-routes.ts`
- `server/src/db/rows.ts`
- `server/package.json`
- `docs/evidence/m2-api-smoke.md` (new)

## Self-review
- No secrets in admin responses. Users carry no channel data, deliveries carry no channel config, and source configs hold no secrets.
- Every body, query and param is parsed with zod (strict bodies).
- Mappers come from `rows.ts`, and the delivery event columns are now shared rather than duplicated.
- The `onRequest` auth hook runs before the admin plugin's `onRequest` `requireAdmin`. The parent hook runs first, so `req.user` is set by then.
- `main.ts` does not validate `PORT`. A non-numeric value makes `listen` throw at startup, which is acceptable for a local dev tool.
- Relative `DB_PATH` and outbox paths resolve against `server/`, because npm workspace scripts run with the workspace as cwd. Both land under the gitignored `data/`.

## Plan/spec defects
- Brief Step 5 says the sources output shows `last_polled_at`. The API returns camelCase `lastPolledAt`, following the controller's shape ruling. Only the wording differs.
- Brief Step 5 uses `npm run dev`. Per the controller, I used `npm run start` so no watch process lingers. Both scripts start the same `src/main.ts`.

## Concerns
None. `admin-routes.ts` is 88 lines, well under the ~250-line limit.
