# World Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, end-to-end alerting app. Real news, market and disaster feeds are scored per user by severity and region proximity, and matching alerts go out by email and Slack. It has a user UI and an admin UI.

**Architecture:** An npm-workspaces monorepo with two parts:
- `server/` is a Fastify + `better-sqlite3` process. It polls sources, normalizes events, scores and matches them against rules, writes a delivery outbox, and dispatches it through pluggable channel adapters.
- `web/` is a Vite React app using RTK Query against `/api`.

Each pipeline stage is a pure function, or a function of `(db, …)`, so it can be tested without HTTP or timers.

**Tech Stack:** Node 24, TypeScript, Fastify 5, better-sqlite3, zod 4, fast-xml-parser 5, nodemailer, vitest. Web: Vite, React 19, Redux Toolkit 2 + RTK Query, react-redux 9, Tailwind 4 (`@tailwindcss/vite`), shadcn CLI (Radix primitives), Playwright for evidence screenshots.

**Spec:** [`docs/superpowers/specs/2026-10-19-world-alerts-design.md`](../specs/2026-10-19-world-alerts-design.md). Read §6–§11 before any server task.

## Global Constraints

- Node `>=24`. Pin dependency **major** versions to the ones checked on 2026-10-19: fastify 5, better-sqlite3 13, zod 4, vitest 5, nodemailer 10, fast-xml-parser 5, vite 8, react 19, @reduxjs/toolkit 2, tailwindcss 4. If an install or API doesn't match what this plan says, **stop and log it in `docs/ai-review-log.md`**. Don't silently switch libraries.
- No ORM. Plain SQL through `better-sqlite3`. Schema in `server/src/db/schema.sql`.
- Every HTTP body, query and path param is parsed with zod. Invalid input → `400 { error, issues }`.
- Secrets: a Slack `webhookUrl` and `SMTP_URL` never appear in API responses (masked as `https://hooks.slack.com/…/XXXX`, i.e. only the last 4 chars) or in logs.
- Scoring constants live **only** in `server/src/scoring/weights.ts`: home 1.0, subregion 0.75, continent 0.4, elsewhere 0.2, global 0.8, unknown 0.2, critical override at severity ≥ 0.9, default threshold 0.5. Compare with an epsilon of `1e-9`.
- Region data comes **only** from `server/src/geo/m49.csv` (a copy of `docs/evidence/m49-check/lukes-all-2026-10-19.csv`). Never hand-type country tables.
- Source tests use the **saved real payloads** in `docs/evidence/feed-probes-2026-10-19/`, copied into `server/test/fixtures/`.
- Every `shortcut:` comment uses the format `// shortcut: <limit>, <when to upgrade>`.
- Process (see `CLAUDE.md`): a branch per milestone, TDD, a commit per task, every prompt logged, every rejected or corrected AI output logged in `docs/ai-review-log.md`.

## Review Focus

1. **A feed is down or returns garbage** (HTTP 500, truncated XML, HTML error page). Expected: that source's `last_error` is set, the other sources and the scheduler keep running, and no partial events are inserted. Test owner: Task 8.
2. **A secret leaks through the API or logs.** Expected: `GET /api/channels` and the admin endpoints never return a full Slack webhook URL, and dispatcher error messages are scrubbed of it. Test owners: Task 6 (adapter `maskConfig`, error scrub) and Task 9 (route response).
3. **A channel is deleted while rules or pending deliveries still reference it.** Expected: no crash. Rules drop the ID, and pending deliveries for it become `failed` with `last_error = 'channel deleted'`. Test owner: Task 9 (delete route) and Task 7 (dispatcher).
4. **Hungarian and accented keywords, or regex metacharacters, in keywords** (`árvíz` vs `ÁRVÍZ`, `c++`, `(BTC)`). Expected: case-insensitive Unicode substring match with no regex injection. Test owner: Task 3.
5. **Out-of-range or unknown input** (threshold `1.5`, category `sports`, non-https webhook, a `channelIds` entry owned by another user). Expected: `400`, and nothing is written. Test owner: Task 9.

---

## File Structure

```
package.json                     workspaces ["server","web"]; scripts dev/test/build
server/
  package.json  tsconfig.json  vitest.config.ts
  src/
    types.ts                     shared domain types (Task 1)
    db/schema.sql  db/index.ts   openDb, schema (Task 1)
    db/seed.ts                   seed users/sources/channels/rules (Task 9)
    geo/m49.csv  geo/index.ts    country lookup (Task 2)
    scoring/weights.ts  scoring/index.ts   proximity + score (Task 2)
    matching/index.ts            rule match + evaluate (Task 3)
    sources/gdacs.ts rss.ts coingecko.ts manual.ts index.ts  adapters (Task 4)
    pipeline/ingest.ts           insert events → deliveries (Task 5)
    channels/email.ts slack.ts index.ts message.ts  adapters + registry (Task 6)
    pipeline/dispatch.ts         outbox dispatcher (Task 7)
    pipeline/poll.ts scheduler.ts  polling (Task 8)
    http/app.ts http/user-routes.ts http/admin-routes.ts http/auth.ts  (Tasks 9–10)
    main.ts                      start server + scheduler (Task 10)
  test/fixtures/*                saved feed payloads
  test/*.test.ts
web/
  (Vite + shadcn scaffold)  src/store.ts src/api.ts src/session.ts src/App.tsx
  src/pages/{Rules,Channels,History}.tsx src/pages/admin/{Users,Rules,Events,Deliveries,Sources}.tsx
  src/components/{UserSwitcher,RuleForm,InjectEventDialog,ScoreBreakdown}.tsx
e2e/screenshots.spec.ts          Playwright evidence (Task 14)
```

## Milestones and branches

| Milestone | Branch | Tasks |
|---|---|---|
| M1 Core engine (no HTTP) | `feat/core-engine` | 1–8 |
| M2 HTTP API | `feat/api` | 9–10 |
| M3 Web UI | `feat/web` | 11–13 |
| M4 End-to-end evidence | `chore/e2e-evidence` | 14 |

Each branch ends with: `npm test` green → a code-review subagent (`superpowers:requesting-code-review`) → findings triaged in writing in `docs/ai-review-log.md` → merge to `main`.

---

### Task 1: Workspace scaffold, domain types, database

**Files:**
- Create: `package.json`, `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/types.ts`, `server/src/db/schema.sql`, `server/src/db/index.ts`, `.gitignore` (add `node_modules`, `data/`, `web/dist`, `test-results/`)
- Test: `server/test/db.test.ts`

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type Category = 'news' | 'market' | 'disaster';
  export type Scope = 'country' | 'global' | 'unknown';
  export interface NewEvent { source: string; externalId: string; category: Category; title: string; summary: string | null; url: string | null; scope: Scope; country: string | null; severity: number; occurredAt: string; raw: unknown }
  export interface EventRow extends NewEvent { id: number }
  export interface User { id: number; name: string; email: string; homeCountry: string; isAdmin: boolean }
  export interface Rule { id: number; userId: number; name: string; categories: Category[]; keywords: string[]; threshold: number; channelIds: number[]; enabled: boolean }
  export type ProximityReason = 'home' | 'subregion' | 'continent' | 'elsewhere' | 'global' | 'unknown';
  export interface ScoreBreakdown { severity: number; proximity: number; proximityReason: ProximityReason; override: boolean; importance: number; threshold: number; fires: boolean }
  export type DeliveryStatus = 'pending' | 'sent' | 'failed';
  ```
- Produces: `openDb(path: string): Database.Database`. Runs `schema.sql` (`CREATE TABLE IF NOT EXISTS …`) and sets `PRAGMA foreign_keys = ON` and `journal_mode = WAL` (WAL is skipped for `:memory:`).
- Tables, per design §6: `users`, `channels`, `rules`, `events` (`UNIQUE(source, external_id)`), `deliveries` (`UNIQUE(event_id, channel_id)`, plus `next_attempt_at TEXT`), `sources`. JSON columns are stored as TEXT.
- Foreign keys: channels and rules → users `ON DELETE CASCADE`. **deliveries.channel_id and deliveries.rule_id → `ON DELETE SET NULL`**, so delivery history survives as an audit trail, and the dispatcher can mark orphans as failed.

- [ ] **Step 1:** Root `package.json`: `"workspaces": ["server","web"]`, scripts `test: npm test -w server -w web --if-present`, `dev: concurrently -n server,web "npm run dev -w server" "npm run dev -w web"`. Install server deps: `fastify@5 better-sqlite3@13 zod@4 fast-xml-parser@5 nodemailer@10`, dev: `typescript tsx vitest@5 @types/better-sqlite3 @types/nodemailer @types/node`. Verify: `npx -w server tsc --version` and `node -e "require('better-sqlite3')(':memory:')"` (run in `server/`) exit 0. If better-sqlite3 has no Node 24 prebuild, log it and stop.
- [ ] **Step 2: Write the failing test** `server/test/db.test.ts`:
  - `openDb(':memory:')` creates all 6 tables (query `sqlite_master`).
  - Inserting two events with the same `(source, external_id)` using `INSERT OR IGNORE` leaves 1 row.
  - Inserting two deliveries with the same `(event_id, channel_id)` leaves 1 row.
  - Deleting a user cascades to their channels and rules (`ON DELETE CASCADE`).
  - Deleting a channel keeps its delivery row, with `channel_id` set to NULL.
- [ ] **Step 3:** Run `npm test -w server`. Expected: FAIL (`openDb` is not defined).
- [ ] **Step 4:** Implement `types.ts`, `schema.sql` and `db/index.ts` (read `schema.sql` with `fs.readFileSync(new URL('./schema.sql', import.meta.url))`).
- [ ] **Step 5:** Run `npm test -w server`. Expected: PASS, 4 tests.
- [ ] **Step 6: Commit** `feat(server): scaffold workspace, domain types, sqlite schema`

### Task 2: Geo lookup and importance scoring

**Files:**
- Create: `server/src/geo/m49.csv` (copied from the evidence file), `server/src/geo/index.ts`, `server/src/scoring/weights.ts`, `server/src/scoring/index.ts`
- Test: `server/test/scoring.test.ts`, `server/test/geo.test.ts`

**Interfaces:**
- Produces: `lookupCountry(iso2: string): { iso2: string; iso3: string; region: string; subregion: string } | undefined` and `iso3ToIso2(iso3: string): string | undefined`. The CSV is parsed once at module load: split on lines, and handle quoted fields with commas such as `"Korea, Republic of"`. Use a tiny CSV split, not a library.
- Produces: `WEIGHTS` (the constants from Global Constraints) and `DEFAULT_THRESHOLD = 0.5`.
- Produces: `proximity(event: Pick<NewEvent,'scope'|'country'>, homeCountry: string): { weight: number; reason: ProximityReason }` and `score(event: Pick<NewEvent,'scope'|'country'|'severity'>, homeCountry: string, threshold: number): ScoreBreakdown`.

- [ ] **Step 1: Write the failing tests.**
  - `geo.test.ts`: `lookupCountry('HU')` → `{iso3:'HUN', region:'Europe', subregion:'Eastern Europe'}`. `AT` → `Western Europe`. `RO` → `Eastern Europe`. `NP` → `Asia`/`Southern Asia`. `iso3ToIso2('VUT') === 'VU'`. `lookupCountry('KR')` is defined (a quoted CSV name). `lookupCountry('XK')` is `undefined`.
  - `scoring.test.ts`: `it.each` over the **12 rows of design §8**, with home `HU` and threshold `0.5`. Assert `importance` (with `toBeCloseTo(x, 3)`), `proximityReason`, `override` and `fires` for each. Inputs: HU news (country HU, 0.5); NP news 0.5; NP breaking 0.8; global 0.5; global 0.8; NP 1.0; RO 0.7; ES 0.7; unknown 0.7; global `0.5`; global `4/6`; global `1.0`. Plus: event country `XK` with home `HU` → `elsewhere`, and event country `XK` with home `XK` → `home`.
- [ ] **Step 2:** Run `npm test -w server -- scoring geo`. Expected: FAIL.
- [ ] **Step 3:** Implement. The override rule: `importance = severity >= 0.9 ? Math.max(severity*weight, severity) : severity*weight`. `fires = importance >= threshold - 1e-9`.
- [ ] **Step 4:** Run. Expected: PASS (13 scoring cases plus the geo cases).
- [ ] **Step 5: Commit** `feat(server): M49 geo lookup and region-weighted scoring`

### Task 3: Rule matching

**Files:**
- Create: `server/src/matching/index.ts`
- Test: `server/test/matching.test.ts`

**Interfaces:**
- Consumes: `score` (Task 2).
- Produces: `matchesContent(rule: Pick<Rule,'categories'|'keywords'>, event: Pick<NewEvent,'category'|'title'|'summary'>): boolean` and `evaluate(rule: Rule, user: User, event: EventRow): ScoreBreakdown | null`. `evaluate` returns `null` when the rule is disabled or the content doesn't match; otherwise it returns the breakdown, and the caller checks `.fires`.

- [ ] **Step 1: Write the failing tests:**
  - Empty categories and keywords match anything.
  - Category mismatch → false.
  - Keywords use OR, case-insensitive, over title + summary.
  - **Review Focus 4:** keyword `árvíz` matches the title `ÁRVÍZ Szegeden`. Keyword `(BTC)` matches the literal `(BTC)` and does not throw. Keyword `c++` matches `c++`. Use `toLocaleLowerCase('hu')` plus `includes`, with no `RegExp`.
  - A disabled rule → `evaluate` returns `null`.
  - A HU user with a rule threshold of 0.3 and a global 0.5 event → `fires: true`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): rule content matching and evaluation`

### Task 4: Source adapters (normalize from real fixtures)

**Files:**
- Create: `server/src/sources/{index,gdacs,rss,coingecko,manual}.ts`, `server/test/fixtures/` (copy `gdacs.xml`, `telex.xml`, `hvg.xml`, `bbcworld.xml`, `coingecko.json` from `docs/evidence/feed-probes-2026-10-19/`)
- Test: `server/test/sources.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SourceAdapter<C> {
    type: 'gdacs' | 'rss' | 'coingecko';
    configSchema: z.ZodType<C>;
    url(config: C): string;
    normalize(body: string, config: C, now: Date): NewEvent[];   // pure; throws on unparseable body
  }
  export const sourceAdapters: Record<SourceAdapter<any>['type'], SourceAdapter<any>>;
  ```
- Configs:
  - gdacs `{}`
  - rss `{ feedId: string; url: string; country: string | null; breakingKeywords: string[] }`. `country: null` → `scope: 'global'`.
  - coingecko `{ coins: string[]; minChangePct: number }` (default `['bitcoin','ethereum']`, `3`)
- Produces: `manualEvent(input: ManualEventInput, now: Date): NewEvent`. `ManualEventInput` is a zod schema with `category`, `title`, `summary?`, `url?`, `country?` (ISO2, validated against `lookupCountry`; absent → `global`), and `severity` (0..1). `externalId = 'manual:' + crypto.randomUUID()`.

- [ ] **Step 1: Write the failing tests** against the fixtures:
  - **gdacs:** returns 225 events, all `category: 'disaster'`. The first item → `externalId: '1572503:Green'`, `country: 'VU'`, `scope: 'country'`, `severity: 0.3`. Severity per level: Green 0.3, Orange 0.7, Red 1.0. Items with an empty `gdacs:iso3` → `scope: 'unknown'`, `country: null`; there are exactly 3 in the fixture. Exactly 1 event has severity 1.0 (Red); 5 have 0.7.
  - **rss (telex, country HU):** 50 events, `scope: 'country'`, `country: 'HU'`, severity 0.5. `externalId` = `<guid>` or else `<link>`. The summary has no HTML tags. A title containing a breaking keyword (case-insensitive) → 0.8.
  - **rss (bbcworld, country null):** `scope: 'global'`.
  - **coingecko** (fixture with BTC +1.04%, ETH +1.26%, `minChangePct: 3`): 0 events. Then an inline body with BTC `-6` → 1 event, severity `1.0`, `scope: 'global'`, `externalId: 'bitcoin:2026-10-19'` (UTC date of `now`), title containing `-6.0%`. ETH `+4` → severity `4/6`.
  - Garbage body (`'<html>oops'`) → `normalize` throws, for gdacs, rss and coingecko alike.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement with `fast-xml-parser` (`ignoreAttributes: false`; read `gdacs:iso3`, `gdacs:alertlevel` and `gdacs:eventid`). Strip HTML with a regex plus entity decoding, and mark it `// shortcut: regex HTML strip, use a sanitizer if summaries are ever rendered as HTML`. News severity gets `// shortcut: RSS has no importance signal, upgrade to LLM scoring (non-goal v1)`.
- [ ] **Step 4:** Run. Expected: PASS. If a count in the fixture doesn't match this plan, **recount from the fixture** before changing the test, and log which one was wrong.
- [ ] **Step 5: Commit** `feat(server): gdacs, rss, coingecko, manual source adapters`

### Task 5: Ingest pipeline (events → deliveries)

**Files:**
- Create: `server/src/pipeline/ingest.ts`, `server/test/helpers.ts` (`makeDb()`, `addUser()`, `addChannel()`, `addRule()` test factories)
- Test: `server/test/ingest.test.ts`

**Interfaces:**
- Consumes: `openDb`, `evaluate`.
- Produces: `ingest(db: Database, events: NewEvent[], now: Date): { inserted: EventRow[]; deliveriesCreated: number }`. This is one transaction: `INSERT OR IGNORE` each event, and for **newly inserted** rows only, evaluate every enabled rule of every user. For each firing rule, for each channel ID in it that belongs to the rule's user and is enabled, do `INSERT OR IGNORE` into a delivery with `status 'pending'`, `attempts 0`, `next_attempt_at = now`, `score = importance` and `score_breakdown = JSON`.

- [ ] **Step 1: Write the failing tests:**
  - Ingesting a HU 0.5 news event for a HU user (rule threshold 0.5, 1 email channel) gives 1 delivery, `pending`, whose breakdown `proximityReason` is `'home'`.
  - Ingesting the same event again gives `inserted: []` and still 1 delivery.
  - The same user with two rules matching the same event on the same channel → 1 delivery.
  - A NP 0.5 event for a HU user → 0 deliveries.
  - A disabled channel → no delivery.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): ingest pipeline with dedup and scored deliveries`

### Task 6: Channel adapters and registry

**Files:**
- Create: `server/src/channels/{index,email,slack,message}.ts`
- Test: `server/test/channels.test.ts`

**Interfaces:**
- Produces: `ChannelAdapter<C>` exactly as in design §10. `AlertMessage = { title: string; summary: string | null; url: string | null; category: Category; country: string | null; importance: number; reason: string }`.
- Produces: `buildMessage(event: EventRow, b: ScoreBreakdown): AlertMessage`. `reason` is for example `"importance 0.53 = severity 0.67 × 0.8 (global) ≥ threshold 0.5"`, or `"… critical override (severity ≥ 0.9)"`.
- Produces: `createChannelRegistry(opts: { smtpUrl?: string; outboxDir: string; slackDryRun: boolean; fetchImpl?: typeof fetch; log: (msg: string) => void }): Record<'email'|'slack', ChannelAdapter<any>>`.
- Produces: `scrubSecrets(text: string, config: unknown): string`. It replaces any string value of `config` longer than 8 chars that appears in `text` with `***`.
- email config `{ to: z.email() }`. Without `smtpUrl`, it uses nodemailer `jsonTransport` and writes `<outboxDir>/<timestamp>-<to>.json`.
- slack config `{ webhookUrl: z.url().startsWith('https://hooks.slack.com/') }`. It POSTs JSON `{ text }` through `fetchImpl`, and a non-2xx response throws `Slack responded <status>`. In dry-run mode it calls `log` with the text and doesn't fetch.

- [ ] **Step 1: Write the failing tests:**
  - email without smtp writes one JSON file in a temp dir containing the title.
  - slack calls `fetchImpl` once with the URL and a body containing the title.
  - slack throws on a 500 response.
  - The slack schema rejects `http://example.com`.
  - **Review Focus 2:** `maskConfig({webhookUrl:'https://hooks.slack.com/services/T0/B0/abcdSECRET1234'})` returns a string that contains `1234` and not `SECRET`. `scrubSecrets('failed https://hooks.slack.com/services/T0/B0/abcdSECRET1234', cfg)` doesn't contain `SECRET`.
  - `buildMessage` reason strings for a normal case and an override case.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): email and slack channel adapters with secret masking`

### Task 7: Dispatcher (outbox → channels, retries)

**Files:**
- Create: `server/src/pipeline/dispatch.ts`
- Test: `server/test/dispatch.test.ts`

**Interfaces:**
- Consumes: `buildMessage`, `scrubSecrets`, the registry from Task 6.
- Produces: `dispatchPending(db: Database, registry: Record<string, ChannelAdapter<any>>, now: Date): Promise<{ sent: number; failed: number; retried: number }>`. It picks deliveries with `status='pending' AND next_attempt_at <= now`, up to a limit of 50.
  - `channel_id IS NULL` (channel deleted) → `failed`, with `last_error 'channel deleted'`.
  - Success → `sent`, `sent_at = now`.
  - Error → `attempts += 1`, and `last_error` = the scrubbed message. If `attempts >= 3` → `failed`; otherwise `next_attempt_at = now + 30s × 2^(attempts-1)`.
- Produces: `MAX_ATTEMPTS = 3`.

- [ ] **Step 1: Write the failing tests** with a fake adapter registered under `'email'`:
  - success → `sent`.
  - Always throwing: after 3 calls (advancing `now` past `next_attempt_at` each time) → `failed`, `attempts 3`.
  - A delivery whose `next_attempt_at` is in the future is skipped.
  - **Review Focus 3:** create a pending delivery, delete its channel row, then dispatch → `failed` with `'channel deleted'`.
  - An error message containing the webhook URL is stored scrubbed.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): outbox dispatcher with retry and backoff`

### Task 8: Polling and scheduler

**Files:**
- Create: `server/src/pipeline/poll.ts`, `server/src/pipeline/scheduler.ts`
- Test: `server/test/poll.test.ts`

**Interfaces:**
- Produces: `pollSource(db: Database, sourceId: number, deps: { fetchImpl: typeof fetch; now: () => Date }): Promise<{ ok: boolean; inserted: number; error?: string }>`. It loads the source row, validates its config with the adapter's schema, fetches `adapter.url(config)` with a 15 s `AbortSignal.timeout` and a `User-Agent: world-alerts/0.1` header, treats non-2xx as an error, then calls `normalize` and `ingest`. It always updates `last_polled_at`, and sets `last_error` to the message or `null`. **It never throws.**
- Produces: `startScheduler(db, deps: { fetchImpl; registry; now; log }): { stop(): void }`. It runs one `setInterval` per tick of 10 s that:
  1. polls every enabled source whose `last_polled_at` is older than `poll_interval_s`, sequentially;
  2. calls `dispatchPending`.

  A re-entrancy guard means only one tick runs at a time.

- [ ] **Step 1: Write the failing tests** with a stub `fetchImpl` returning fixture bodies:
  - Polling GDACS inserts 225 events and sets `last_error` to null.
  - **Review Focus 1:** the stub returns status 500 → `ok:false`, `last_error` contains `500`, 0 events. The stub returns `'<html>oops'` with 200 → `ok:false`, 0 events. A stub that throws (network error) → `ok:false`.
  - After a failing source, polling a second source still works.
  - A disabled source isn't polled by one scheduler tick. Export `runTick(db, deps)` for the test, and have `startScheduler` call it.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): source polling with isolated failures and scheduler`
- [ ] **Step 6: Milestone gate M1:** `npm test -w server` is green. Dispatch the code-review subagent on `feat/core-engine` and triage its findings into `docs/ai-review-log.md`. Merge to `main`.

### Task 9: HTTP app, user routes, seed

**Files:**
- Create: `server/src/http/app.ts`, `server/src/http/auth.ts`, `server/src/http/user-routes.ts`, `server/src/db/seed.ts`
- Test: `server/test/api-user.test.ts`

**Interfaces:**
- Produces: `buildApp(db: Database, deps: { registry; fetchImpl; now: () => Date; log }): FastifyInstance` (no `listen`; tests use `app.inject`).
- `auth.ts`: a preHandler reads `X-User-Id`, loads the user, and sets `req.user`. Missing or unknown → `401`. `requireAdmin` → `403` for non-admins. Mark it `// shortcut: header identity, not authentication; replace with real auth before any deployment`.
- Routes: as in design §11 (user part). Rule body zod: `name` 1..100, `categories` ⊆ enum, `keywords` max 20 strings of 1..50 chars, `threshold` 0..1, `channelIds` that must all belong to `req.user` (else `400`), `enabled`. Channel bodies are validated by `registry[type].configSchema`, and responses use `maskConfig`.
  - `DELETE /api/channels/:id` removes the ID from the user's rules' `channelIds` in the same transaction.
  - `POST /api/channels/:id/test` sends `buildMessage` of a synthetic event straight away and returns `{ ok, error? }`.
  - `GET /api/my/deliveries` joins `events` and parses `score_breakdown`.
- `seed(db)` is idempotent and only runs when `users` is empty. It creates:
  - users: `Anna (HU, admin)`, `Bence (HU)`, `Priya (NP)`
  - one email channel each, and Bence also gets a slack channel only if the `SEED_SLACK_WEBHOOK` env var is set
  - one default rule per user (all categories, threshold 0.5)
  - sources: gdacs, coingecko, rss telex (HU), rss hvg (HU), rss bbc-world (global), each with `poll_interval_s 300`

- [ ] **Step 1: Write the failing tests:**
  - No header → 401.
  - Rule CRUD round-trip.
  - **Review Focus 5:** threshold `1.5` → 400; category `sports` → 400; a `channelIds` entry of another user → 400; a slack `http://` webhook → 400. In each case the table row count is unchanged.
  - **Review Focus 2:** `GET /api/channels` after creating a slack channel doesn't contain the secret part.
  - **Review Focus 3:** deleting a channel removes it from the rule's `channelIds`.
  - The seed run twice still gives 3 users.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(api): fastify app, header identity, user routes, seed`

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
  - `GET /api/admin/sources`, `PATCH /api/admin/sources/:id` with `{ enabled?, pollIntervalS? (60..86400) }` (renamed from `poll_interval_s` after the M2 review, D-020), and `POST /api/admin/sources/:id/poll`, which calls `pollSource` and returns its result
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

### Task 11: Web scaffold, store, user switcher

**Files:**
- Create: `web/` from `npm create vite@latest web -- --template react-ts`, then Tailwind 4 through `@tailwindcss/vite`, then `npx shadcn@latest init` (pick **Radix** as the primitive library and the default style). Add components: `button card input label select slider switch table tabs dialog badge checkbox sonner`.
- Create: `web/src/store.ts`, `web/src/session.ts`, `web/src/api.ts`, `web/src/components/UserSwitcher.tsx`
- Modify: `web/vite.config.ts` (`server.proxy['/api'] = 'http://localhost:3000'`, `@` alias as shadcn requires)
- Test: `web/src/api.test.ts` (vitest; dev deps `vitest@5 jsdom @testing-library/react`, `environment: 'jsdom'`)

**Interfaces:**
- `session.ts`: `sessionSlice` with `{ userId: number }` (default `1`, persisted to `localStorage` inside try/catch) and the action `setUser(id)`.
- `api.ts`: a single `createApi`, with `baseQuery = fetchBaseQuery({ baseUrl: '/api', prepareHeaders: (h, { getState }) => h.set('X-User-Id', String(getState().session.userId)) })`.
  - tagTypes `['Me','Rules','Channels','MyDeliveries','Users','AdminRules','Events','Deliveries','Sources']`.
  - One endpoint per route in Tasks 9–10, with hooks exported (`useGetMeQuery`, `useCreateRuleMutation`, …). Mutations invalidate the matching tags. `injectEvent` invalidates `Events`, `Deliveries` and `MyDeliveries`.
  - **Switching user must reset the cache:** dispatch `api.util.resetApiState()` in the `setUser` thunk.
- `UserSwitcher`: a shadcn `Select` listing `/api/admin/users`. It falls back to IDs 1–3 if that returns 403 (non-admin). `// shortcut: dev user switcher stands in for login`.

- [ ] **Step 1: Write the failing test:** `prepareHeaders` sets `X-User-Id` from the state. Use a configured store and a mocked `fetch`, and assert the request header equals `'2'` after `setUser(2)`.
- [ ] **Step 2–4:** Fail → implement → pass. Also run `npm run build -w web`; expected exit 0.
- [ ] **Step 5: Commit** `feat(web): vite+tailwind+shadcn scaffold, rtk query api, user switcher`

### Task 12: User pages: My alerts, Channels, History

**Files:**
- Create: `web/src/App.tsx` (top nav: My alerts · Channels · History · Admin (admins only); a `react-router` v7 or state-based tabs, executor's choice, logged), `web/src/pages/{Rules,Channels,History}.tsx`, `web/src/components/{RuleForm,ScoreBreakdown}.tsx`
- Test: `web/src/components/ScoreBreakdown.test.tsx` (`@testing-library/react`)

**Interfaces:**
- `ScoreBreakdown({ b }: { b: ScoreBreakdown })` renders `severity × proximity (reason) = importance`, `≥ threshold` or `< threshold`, and a `critical override` badge when `b.override`. The server type is duplicated in `web/src/types.ts`. `// shortcut: duplicated types, extract a shared package if they drift`.
- `RuleForm`: name, category checkboxes, keywords as comma-separated input, a threshold `Slider` (0–1, step 0.05, value shown), and channel checkboxes. API `400` issues are shown inline.
- Channels page: list with masked config, add email or Slack (type select plus fields), enable switch, and a "Send test" button showing a toast with `ok`/`error`.
- History: a table of my deliveries (time, title, category, country, status, `ScoreBreakdown`).

- [ ] **Step 1: Write the failing test:** `ScoreBreakdown` with the override case shows `critical override`, and the normal case shows `0.53` and `≥ 0.5`.
- [ ] **Step 2–4:** Fail → implement → pass. `npm run build -w web` exits 0.
- [ ] **Step 5: Manual check** with both servers running:
  1. As Bence, create a rule with threshold 0.3.
  2. Add an email channel and click "Send test". A file appears in `data/outbox/`.
- [ ] **Step 6: Commit** `feat(web): user rules, channels, history pages`

### Task 13: Admin pages

**Files:**
- Create: `web/src/pages/admin/{AdminLayout,Users,Rules,Events,Deliveries,Sources}.tsx`, `web/src/components/InjectEventDialog.tsx`

**Interfaces:**
- Admin uses Tabs: Users, Rules, Events, Deliveries, Sources.
  - Deliveries: a status filter, `ScoreBreakdown`, `last_error`, and a Retry button on `failed` rows.
  - Sources: an enabled `Switch`, an interval input, "Poll now" (with a toast showing the result), `last_polled_at` and `last_error`.
  - `InjectEventDialog`: category, title, summary, country (an ISO2 text input; the server validates it), and a severity slider. On success the toast reads `N deliveries created`.

- [ ] **Step 1: Manual check** (the UI pages carry no unit tests; the logic is covered server-side):
  1. As Anna, inject a `HU` news event at 0.6.
  2. Deliveries shows 2 new rows: Anna and Bence, with no row for Priya.
  3. Inject `NP` at 1.0. Deliveries shows 3 rows with the `critical override` badge.
  4. Toggle a source off, then click "Poll now". The poll still runs, because "Poll now" is manual.
  5. As Bence, the Admin tab isn't shown, and calling `/api/admin/*` returns 403.
- [ ] **Step 2:** `npm run build -w web` exits 0, and `npm test` is green.
- [ ] **Step 3: Commit** `feat(web): admin views and inject event dialog`
- [ ] **Step 4: Milestone gate M3** on `feat/web`.

### Task 14: End-to-end evidence and README

**Files:**
- Create: `e2e/screenshots.spec.ts`, `playwright.config.ts` (`webServer` runs `npm run dev`, with `DB_PATH=data/e2e.db` deleted before the run), `docs/evidence/screenshots/*.png`, `docs/verification.md`
- Modify: `README.md` (what it is, quick start: `npm install && npm run dev`, then open http://localhost:5173; env vars `SMTP_URL`, `SLACK_DRY_RUN`, `SEED_SLACK_WEBHOOK`, `PORT`, `DB_PATH`; architecture diagram; links to docs and prompts)

- [ ] **Step 1:** The Playwright spec walks through the Task 13 manual check (inject HU 0.6, then NP 1.0, then check the Deliveries rows) and saves screenshots of: My alerts, Channels, History, Admin Deliveries with breakdowns, Admin Sources, and the inject dialog. Run with `npx playwright test`. Expected: pass, and 6 PNGs.
- [ ] **Step 2:** If a real Slack webhook is available, set `SEED_SLACK_WEBHOOK` and `SLACK_DRY_RUN=0`, inject a critical event, and screenshot the Slack message. If not, record in `docs/verification.md` that Slack was verified in dry-run mode only. **Don't claim a real delivery that didn't happen.**
- [ ] **Step 3:** `docs/verification.md`: a table of each spec goal (§2) → how it was verified (test name, screenshot or command output) → result. List what was **not** verified.
- [ ] **Step 4: Commit** `chore: e2e screenshots, verification report, README`
- [ ] **Step 5: Final gate:** a whole-repo review subagent (`ponytail:ponytail-review` or `superpowers:requesting-code-review`), with its findings triaged. Merge to `main`.
