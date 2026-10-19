# Final review: M2 "HTTP API" (`feat/api`, 8a9ed68..fff5f8a)

Reviewer: whole-branch review before the merge to `main`. Read-only, except for this file.

What I ran:
- `npx vitest run test/api-user.test.ts test/api-admin.test.ts`: 69/69 pass.
- A throwaway tsx script (in the scratchpad; the temp copy was deleted) that runs the Slack `configSchema` on `https://hooks.slack.com/…/1234`. It parses as **valid**. Invalid inputs produce zod 4 issues that do **not** echo the input value.
- A throwaway Node script: Node 24 `http.get('http://localhost:…')` reaches a server bound only to `127.0.0.1`. So the Vite proxy target in Task 11 is fine.

## Strengths

- **Ownership is enforced in one place and fails closed.** Every user-scoped read goes through `rule`/`channel` statements keyed on `id AND user_id`. Foreign IDs get `404`, the same as missing ones, so nothing leaks about whether a record exists. `channelIds` are de-duplicated and checked against the caller's channels on create and on PATCH. Tests check that the foreign row is unchanged afterwards.
- **Admin is gated by plugin encapsulation.** `requireAdmin` is an `onRequest` hook inside the `/admin` plugin and runs after the parent's `authenticate`. A table test covers all 9 admin routes for a non-admin and asserts `403`, no fetch, no event insert and no source change.
- **Auth runs at `onRequest`**, so an unknown caller gets `401` before the body is parsed (deferred item 1 is already fixed and tested at `api-admin.test.ts:53`). The `X-User-Id` parsing is strict (`1abc`, `0`, `-1`, `1.5` → 401). The server listens only on `127.0.0.1`, marked with a `shortcut:` comment.
- **Secrets.** Responses only ever go through `maskConfig`. Fastify's logger is off. The 500 path logs a pattern-scrubbed message (Slack hooks and `//user:pass@`, which covers `SMTP_URL` credentials) and returns a generic body. Zod 4 issues don't echo input values, so a rejected webhook isn't reflected back. Tests assert this on POST, GET and PATCH of channels, on admin deliveries with a seeded webhook, and on the 500 log.
- **Multi-step writes.** Channel delete plus rule clean-up is one `db.transaction`, and so is the seed. Every other write is a single statement, or a check followed by a write with no `await` in between, which is atomic on the single-threaded synchronous driver. Retry is one conditional `UPDATE … AND status='failed'`, so a retry can't race the dispatcher.
- **Plan alignment is close to literal.** All routes in spec §11 exist. Status codes are sensible and consistent: 201 create, 204 delete, 400 zod, 404, 409 retry-not-failed, and 200 `ok:false` for test-send and poll failures. Inject goes through `manualEvent → ingest` (no demo shortcut). The plan's IDs 1–3 hold for the seeded data.
- **Tests are good for Review Focus 2, 3 and 5.** Every 400 case asserts that row counts are unchanged. RF3 checks both rules and that delivery history survives (`channel_id IS NULL`). The inject tests reproduce the plan's numbers (2 for HU 0.6, 3 for NP 1.0 with the override). The smoke evidence is real and matches.

## Issues

### Critical

None.

### Important

**I-1. A masked webhook is accepted as a valid webhook, so sending the masked value back destroys the secret.** (`server/src/channels/slack.ts:6`, reached through `server/src/http/user-routes.ts:124`)
- **What:** `maskConfig` returns `https://hooks.slack.com/…/1234`, and the schema (`z.url({protocol:/^https$/})` plus `startsWith('https://hooks.slack.com/')`) accepts that string. I confirmed this by running it. `PATCH /api/channels/:id { config: <masked config from GET> }` therefore stores the mask over the real URL with a `200`. After that, every send fails (Slack returns 404 → `failed`), and the user can't see why, because the masked view looks the same as before.
- **Why it matters now:** a UI edit form that pre-fills from `GET /api/channels` and submits the whole object is the natural thing to build in Task 12 ("list with masked config", plus edit/enable). No test covers it.
- **Fix (one line, plus a test):** tighten the schema to the real webhook shape, e.g. `startsWith('https://hooks.slack.com/services/')` and/or reject `…`. Add a test that PATCHing the masked config gives `400` and leaves the row unchanged. Optionally, treat "config equal to the masked value" as "keep the current config".

### Minor

**M-1. `poll_interval_s` is the only snake_case field in the API.** (`server/src/http/admin-routes.ts:16`)
- **What:** the PATCH body uses snake_case, while every response uses camelCase (`pollIntervalS`).
- **Why:** this is what the plan says, but it breaks "consistent camelCase", and once M3 is built against it, changing it means editing both sides.
- **Fix:** rename it to `pollIntervalS` now, update the 6 tests, and log it as a plan amendment. *Recommended before the merge (cheap), but not blocking.*

**M-2. The scheduler starts before `listen`.** (`server/src/main.ts:25-28`)
- **What:** `startScheduler` runs one tick immediately (`scheduler.ts:44`), and that tick reaches `dispatchPending` synchronously when no source is due. If `listen` then fails with `EADDRINUSE` (most likely because a second `npm run dev` points at the same `data/alerts.db`), the second process can already have selected and started sending pending deliveries. The first process does the same, so a user can get duplicate alerts (spec §4 anti-goal), and only then does the second process crash.
- **Fix:** move `startScheduler` after `await app.listen(...)`. *Fix before the merge: it's a 2-line reorder.*

**M-3. Error bodies aren't all the same shape.** (`server/src/http/app.ts:24`)
- **What:** Fastify client errors return `{ error, code }` with no `issues`. Zod errors and route-level 400s return `{ error: 'invalid request', issues }`. Every other error is `{ error }`.
- **Why:** it's fine as long as the UI treats `issues` as optional. Task 12's "API 400 issues shown inline" just needs to know that.
- **Fix:** none needed in the server. Note it for M3.

**M-4. Channel config issue paths are relative to `config`.** (`server/src/http/user-routes.ts:113`, `:124`)
- **What:** a bad webhook gives issue path `['webhookUrl']`, not `['config','webhookUrl']`.
- **Fix:** before rethrowing, map the issues to prefix them with `config`, or document it for the UI. *Can wait.*

**M-5. Some write statements don't repeat `AND user_id = ?`.** (`server/src/http/user-routes.ts:43-44, 49-50`)
- **What:** `updateRule`, `setRuleChannels`, `updateChannel` and `deleteChannel` don't include the user ID in the `WHERE`.
- **Why:** they're safe today, because every caller checks ownership first. This is defence in depth only. *Can wait.*

**M-6. The `/my/deliveries` limit has no `shortcut:` comment.** (`server/src/http/user-routes.ts:56`)
- **What:** `LIMIT 100` is a silent cap, while the admin query (`admin-routes.ts:28`) has its shortcut comment. *Fix now if anything else gets touched (one comment).*

**M-7. `masked()` uses an unguarded registry lookup.** (`server/src/http/user-routes.ts:63`)
- **What:** it uses `registry[c.type]?.` without `Object.hasOwn`. It can't be reached today, because POST guards `type`. *Can wait.*

**M-8. Shutdown can leave a send untracked.** (`server/src/main.ts:31-36`)
- **What:** if `app.close()` rejects, `db.close()` is skipped. An in-flight tick isn't awaited before `db.close()`, so a send that is in flight at SIGTERM may be repeated on the next start. That's acceptable at-least-once behaviour.
- **Fix:** a try/finally. *Can wait.*

**M-9. The outbox path is relative to the server directory.** (`server/src/main.ts:20`)
- **What:** `data/outbox` resolves against the cwd, which is `server/` under `npm run … -w server`. So the files go to `server/data/outbox/`, not the repo-root `data/outbox/` that Task 12's manual step and spec §10 mention. Git still ignores them (`data/` matches at any level).
- **Fix:** say which path in the README (Task 14), or resolve the path from the repo root. *Can wait.*

## UI readiness (Tasks 11–13)

Every screen has the endpoints and fields it needs:

- **Switcher:** `/api/me` (with `isAdmin`) and `/api/admin/users`. Seeded IDs 1–3 match the plan's fallback for non-admins.
- **Rule form:** `/api/channels` returns `type` plus the masked config, which is enough to label the checkboxes ("email · bence@example.com", "slack · …/1234"). No channel `name` is needed.
- **History:** `/my/deliveries` has the time, title, category, country, status and breakdown.
- **Admin tabs:** users, rules (`userId` and `channelIds` can be joined to the users list), events, deliveries (`userId`, status filter, `lastError`, retry returns the updated row), sources (all fields; poll returns `{ok, inserted, error?}` for the toast), and inject (`deliveriesCreated` for the toast).
- **Gaps:** none blocking. Watch for I-1 (masked round-trip), M-1 (the PATCH field name) and M-3 (`issues` is optional).

## Deferred-minor triage

**Task 9:**
- Auth as preHandler → move to `onRequest`: **already fixed** (`app.ts:32`, tested at `api-admin.test.ts:53`).
- UPDATE/DELETE without `AND user_id = ?`: **can wait** (M-5; ownership is checked first).
- Seed doesn't validate the webhook: **can wait** (operator-supplied env, and the dispatcher `safeParse`s config before sending).
- `/my/deliveries` loses history when both the channel and the rule are deleted: **can wait** (needs `deliveries.user_id`; add a `shortcut:` comment).
- Malformed-JSON 400 has no `issues`: **can wait** (M-3; the UI treats `issues` as optional).
- 4xx passthrough keyed only on `statusCode` (`app.ts:24`): **can wait** (only Fastify's own errors carry a 4xx `statusCode` here).
- Test-send scrub doesn't cover `SMTP_URL`: **can wait** (nodemailer errors don't echo the URL, and the 500 log is pattern-scrubbed).
- `masked()` has no `Object.hasOwn`: **can wait** (M-7, unreachable).
- `LIMIT 100` has no `shortcut:` comment: **fix before the merge if convenient** (one comment, a project rule).
- No test that test-send scrubs a thrown webhook-bearing error: **can wait** (the Slack adapter throws only `err.name` and the status, so the URL never reaches the message).

**Task 10:**
- `app.close()` rejecting skips `db.close`: **can wait** (M-8).
- Scheduler starts before `listen`: **fix before the merge** (M-2, a double-dispatch path on a second start).
- "Unknown id → 404" tests can't tell a handler 404 from a missing route: **can wait** (the paired bad-id `400` and success tests prove the routes exist).
- A manual poll can overlap a scheduler poll: **can wait** (`INSERT OR IGNORE` dedup makes it harmless).
- The second passing test in the RED evidence is unnamed: **can wait** (process note only).

## Declined to judge

- **Pending deliveries of a deleted rule are still sent.** Delete sets `rule_id` NULL and the dispatcher ignores rules. The spec is silent, the window is at most about 10 s or until the retry backoff ends, and it's M1 dispatcher behaviour, not M2.
- **Test-send sends even when the channel is disabled.** Commented in the code as an explicit user action, and reasonable.
- **Non-admins see bare IDs 1–3 in the switcher.** This is the plan's fallback. A public `/api/users` would be nicer, but that's a plan change, not a defect.
- **Lowercase ISO2 (`hu`) is rejected with `400` on inject.** It's correct, if strict. The UI should uppercase the input.
- **`raw` included in `/api/admin/events` (up to 500 rows).** Payload size is a UI and performance concern, not a correctness one, at this scale.

## Ready to merge?

**With fixes.** Fix I-1 first: tighten the Slack schema so it rejects the masked value, and add a PATCH round-trip test, because Task 12 will likely build exactly that edit flow. M-2 (start the scheduler after `listen`) and M-1 (`pollIntervalS`) are a few lines each and are best done before M3 builds against the API. Nothing else blocks.
