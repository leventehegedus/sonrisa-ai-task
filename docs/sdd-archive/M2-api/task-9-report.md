# Task 9 report: HTTP app, user routes, seed

**Status:** DONE_WITH_CONCERNS (minor, listed below). Commit `708ba70` on `feat/api`.
**Author model:** Claude Opus 5.5

## What I built
- `server/src/http/app.ts`: `buildApp(db, deps)` returns a Fastify 5 instance and does not listen. It has a single `setErrorHandler`:
  - `ZodError` → `400 { error: 'invalid request', issues }`
  - Fastify's own 4xx errors (malformed JSON, empty JSON body, wrong content type, body too large) → that status with `{ error: message, code }`
  - anything else → `500 { error: 'internal error' }`, with `deps.log('http error: …')` scrubbed by pattern (Slack webhook paths and `//user:pass@` URL credentials). No stack trace is logged or returned.
  - There is also a JSON 404 handler. Every `/api/*` route sits in a plugin with the auth preHandler.
- `server/src/http/auth.ts`: `authenticate(db)` preHandler, `requireAdmin` (→ `403 { error: 'admin only' }`), `positiveInt` / `POSITIVE_INT` (`/^[1-9]\d{0,14}$/`, so the value is always a safe integer). It carries the brief's comment exactly: `// shortcut: header identity, not authentication; replace with real auth before any deployment`. It adds a `FastifyRequest.user: User` augmentation.
- `server/src/http/user-routes.ts`: the user routes below (165 lines).
- `server/src/db/rows.ts` (extended per R-P5): `rowToChannel` (with `ChannelRow` type) and `rowToDeliveryWithEvent`. Route files contain no mapping code.
- `server/src/db/seed.ts`: `seed(db, { slackWebhook? })`. It runs in one transaction, does nothing unless `users` is empty, and never reads `process.env`.
  - Users: Anna (HU, admin), Bence (HU), Priya (NP), with emails `<name>@example.com`.
  - Each user gets one email channel with `to` = their email, plus a Slack channel for Bence when a webhook is passed.
  - Each user gets one rule `Default` (all categories, no keywords, threshold 0.5) that lists all their channels.
  - Sources: GDACS `{}`; CoinGecko `{coins:[bitcoin,ethereum],minChangePct:3}`; Telex `https://telex.hu/rss` HU; HVG `https://hvg.hu/rss` HU; BBC World `https://feeds.bbci.co.uk/news/world/rss.xml` global. All use `poll_interval_s 300`. Each config goes through `sourceAdapters[type].configSchema.parse` before insert.

## Routes (all require `X-User-Id`; missing, malformed (`1abc`, `0`, `-1`, `1.5`) or unknown → 401)
| Route | Success | Errors |
|---|---|---|
| GET /api/me | 200 user | |
| GET /api/rules | 200 list | |
| GET /api/rules/:id | 200 | 400 bad id, 404 not own |
| POST /api/rules | 201 rule | 400 zod / foreign or unknown channelIds |
| PATCH /api/rules/:id | 200 rule | 400, 404 |
| DELETE /api/rules/:id | 204 | 400, 404 |
| GET /api/channels | 200 masked list | |
| GET /api/channels/:id | 200 masked | 400, 404 |
| POST /api/channels | 201 masked | 400 unknown type / bad config / unknown keys |
| PATCH /api/channels/:id (`config`, `enabled`; `type` rejected by strict schema) | 200 masked | 400, 404 |
| DELETE /api/channels/:id | 204 | 400, 404 |
| POST /api/channels/:id/test | 200 `{ok:true}` or `{ok:false,error}` | 400, 404 |
| GET /api/my/deliveries | 200 (newest first, limit 100) | |

Rule and channel bodies use `z.strictObject`. Rule `channelIds` are de-duplicated and must all belong to `req.user`, on both create and PATCH. Email `to` defaults to the user's email on create, and also on PATCH when `to` is left out. The test send works on disabled channels too. It builds a synthetic `EventRow` (id 0, source `test`, global, severity 1) and a breakdown from `score(event, user.homeCountry, 0.5)`, and scrubs the error with `scrubSecrets(msg, config)`. `my/deliveries` returns a user's delivery when its channel or its rule belongs to that user.

## Tests
- `server/test/api-user.test.ts` (32 tests). These use the real `createChannelRegistry`: Slack has dry-run off and a stubbed fetch whose status the test sets, and email writes to a tmp outbox.
  - identity: no header → 401; `1abc`/`0`/`-1`/`1.5`/`999` → 401; `/api/me`; `requireAdmin` 403/pass.
  - rules: CRUD round-trip (including duplicate channelIds collapsed), defaults, another user's rule → 404 on GET/PATCH/DELETE and left untouched, bad path id → 400.
  - **Review Focus 5:** threshold 1.5, category `sports`, empty name, 21 keywords, a 51-char keyword → 400 with `rules` count unchanged. A foreign `channelIds` entry → 400 on POST (count unchanged) and on PATCH (row unchanged). PATCH threshold 1.5 → row unchanged. Slack `http://` webhook, non-Slack host, unknown type `sms`, bad email → 400 with `channels` count unchanged and the secret not echoed. PATCH `type` and PATCH with a bad config → 400 with the row unchanged.
  - **Review Focus 2:** after creating a Slack channel, the POST, GET-list and PATCH responses don't contain `SECRET`, and the list shows `https://hooks.slack.com/…/1234`.
  - **Review Focus 3:** deleting a channel removes it from both rules that referenced it. The channel row is gone, the delivery count is unchanged, and that delivery now has `channel_id IS NULL`.
  - Channel test send: ok on a disabled email channel; Slack 500 → HTTP 200 `{ok:false,error:'Slack responded 500'}`.
  - errors: malformed JSON → 400 `{error}`; a thrown error carrying a webhook → 500 `{error:'internal error'}`, logged without `SECRET`.
  - deliveries: only Bence's rows, newest first, full item shape including the parsed breakdown.
- `server/test/seed.test.ts` (3 tests):
  - full contents, and every seeded source config safeParses with its adapter's `configSchema`
  - running it twice → 3 users / 3 channels / 3 rules / 5 sources
  - the Slack channel is only for Bence, only when the webhook is given, and is linked into his rule

## TDD evidence (R-P9)
Stubs came first (`buildApp` → bare `Fastify()`, `requireAdmin` no-op, `seed` no-op). RED run: `Tests  33 failed | 2 passed (35)`. Sample failures:
- `FAIL test/api-user.test.ts > identity > no X-User-Id → 401` — `AssertionError: expected 404 to be 401`
- `FAIL … > requireAdmin → 403 …` — `AssertionError: expected undefined to deeply equal { c: 403, b: { error: 'admin only' } }`
- `FAIL … > POST /api/rules with threshold 1.5 → 400 …` — `AssertionError: expected 404 to be 400`
- `FAIL … > unexpected error → 500 …` — `AssertionError: expected { statusCode: 500, …(2) } to deeply equal { error: 'internal error' }`
- `FAIL test/seed.test.ts > seed > is idempotent …` — `AssertionError: expected [ +0, +0, +0, +0 ] to deeply equal [ 3, 3, 3, 5 ]`

The 2 that passed against the stub were "malformed JSON → 400" (Fastify's default already does it) and "foreign channel → 404" (the stub returns 404 for everything). Both tests are still meaningful against the real routes.

GREEN: `Tests  35 passed (35)`.

Mutation checks:
- Removing the log scrub fails "unexpected error → 500 …".
- Disabling the rule-update step in channel delete fails "Review Focus 3 …".
- Both were restored.

One test fix during GREEN: my first 500-test dropped the `rules` table after `buildApp`. That breaks statement preparation at plugin boot, not at request time, so I replaced it with a throwing `/boom` route.

## Verification
- `npm run typecheck -w server` → `> tsc --noEmit` (no errors)
- `npm test -w server` → `Test Files  12 passed (12)` / `Tests  175 passed (175)` (140 earlier + 35 new)

## Files changed
- A `server/src/http/app.ts`, `server/src/http/auth.ts`, `server/src/http/user-routes.ts`, `server/src/db/seed.ts`
- M `server/src/db/rows.ts`
- A `server/test/api-user.test.ts` (246 lines), `server/test/seed.test.ts`

## Self-review
- Ownership is checked in SQL (`WHERE id = ? AND user_id = ?`), so a foreign row returns 404 and doesn't reveal that it exists.
- Rejected writes go through validation and ownership checks before any SQL write.
- Lookups by type use `Object.hasOwn(registry, type)`, so `__proto__` or `constructor` can't resolve to an adapter.
- zod 4 issues don't echo input values. The test confirms the webhook isn't echoed in 400s.
- Channel delete runs in one `db.transaction`.
- The email default only applies when `config` is undefined or a plain object, so spreading a string can't smuggle in a valid config.

## Plan/spec defects
- The brief says Bence's Slack channel is created "only if the `SEED_SLACK_WEBHOOK` env var is set". The controller ruling says `seed(db, { slackWebhook })` with no env read inside seed. I followed the controller; main.ts (Task 10/11) must pass `process.env.SEED_SLACK_WEBHOOK`.
- §11 lists `GET|POST|PATCH|DELETE /api/rules` without `/:id`. I added `GET /rules/:id` and `GET /channels/:id`, because the controller's 404 ruling implies per-id GET.
- The spec and plan give no breaking-keyword list for the seeded feeds. I chose `['rendkívüli', 'breaking']` for HU and `['breaking']` for BBC; adjust if a list was intended.

## Concerns
1. Auth runs as a `preHandler`, as the brief says. That means Fastify parses the body (up to 1 MB) before the 401 check, so an unauthenticated malformed-JSON request gets 400, not 401. `onRequest` would close this; I didn't change it because the brief names a preHandler.
2. seed stores `slackWebhook` without validating it against the Slack schema, because seed has no registry. A bad env value would surface as a dispatch failure, `invalid config`.
3. `my/deliveries` finds a user's deliveries through the channel or rule. If both are deleted (both FKs are SET NULL), those history rows no longer show up for the user; the admin views still see them.
4. Fastify 4xx passthrough returns Fastify's own message text (for example "Body is not valid JSON…"). That text is safe, but it is not the zod `issues` shape.
