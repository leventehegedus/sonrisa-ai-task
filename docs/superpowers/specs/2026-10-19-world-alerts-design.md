# World Alerts — Design

**Date:** 2026-10-19
**Status:** Draft, awaiting approval
**Source brief:** [`docs/task-brief.md`](../../task-brief.md)
**Decision log:** [`docs/decisions.md`](../../decisions.md)

Labels used below: **[user]** = decided by the user. **[agent's call]** = decided by the agent and open to override. **[builder]** = left to whoever implements it.

---

## 1. Intent

The PM wants users to get notified when "something important happens in the world": breaking news, market movements, natural disasters. Notifications go over email and Slack, more channels must be easy to add, and admins need a view.

The take-home is graded on **process, not product** (see the brief). The implementation should therefore be a **thin, working, end-to-end slice** where every part is easy to explain and every AI-produced artifact has been checked. Breadth of features is explicitly not a goal.

## 2. Goals

1. A user can create **alert rules** and get notified on **email** and/or **Slack** when a matching event happens.
2. Events come from **real, free, no-key feeds** (news, markets, disasters), plus an **admin "inject test event"** button so demos never depend on live news. **[user]**
3. "Important" is decided by a **transparent, region-weighted score**, not a black box. Every delivery records *why* it fired. **[user]**
4. Adding a channel = writing **one adapter file** and registering it. **[user]**
5. An **admin view** with users, rules, events, the delivery log (with retry), and source on/off switches. **[user]**
6. A reviewer can run everything locally with **one install and one start command**, without Docker or API keys.

## 3. Non-goals (v1)

- Real authentication or authorization. A seeded user switcher stands in for login. **[agent's call]**
- Multiple tenants, organizations, teams.
- Mobile push, SMS, Teams, webhooks (the adapter interface allows them later).
- ML/LLM-based event classification or summarization.
- Digests, quiet hours, per-user rate limiting.
- Production deployment, horizontal scaling, external job queues.

## 4. Anti-goals (failure even if it "works")

- A polished UI with no visible reasoning or verification trail.
- Alerts that fire with no explanation of *why* (an opaque score).
- Spam: the same event delivered twice to the same user on the same channel.
- A demo that only works when the internet happens to have news that minute.
- Secrets (Slack webhook URLs, SMTP passwords) in logs, API responses or git.
- AI-generated code merged without a test or a manual check that ran.

## 5. Constraints

- **Stack [user]:** TypeScript + Node + SQLite. Frontend: React + Vite, Redux Toolkit + RTK Query, shadcn/ui defaults (Radix primitives) + Tailwind.
- **Backend libraries [agent's call]:** Fastify, `better-sqlite3` (plain SQL, no ORM), `zod`.
- **Process [user]:** every prompt logged in `prompts/`, every decision in `docs/decisions.md`, a commit at the end of every prompt, a branch per feature or fix.
- **AI tooling [user]:** Claude Code with superpowers, caveman, ponytail ([`docs/setup-skills.md`](../../setup-skills.md)).
- **Time:** about 24 hours in total. A partial but well-reasoned solution beats a complete but undocumented one.

## 6. Domain model

### 6.1 Event (normalized) [user: one shape for all sources]

| Field | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `source` | text | `gdacs`, `rss:<feed-id>`, `coingecko`, `manual` |
| `external_id` | text | Source's own ID. `UNIQUE(source, external_id)` is the dedup key. |
| `category` | text | `news` \| `market` \| `disaster` |
| `title` | text | |
| `summary` | text? | |
| `url` | text? | |
| `country` | text? | ISO 3166-1 alpha-2. `NULL` unless `scope = 'country'`. |
| `scope` | text | `country` (has a country) \| `global` (worldwide by nature: markets, world-news feeds) \| `unknown` (has a location but no country, e.g. a quake at sea). Kept separate so "global" and "we don't know" don't score the same. **[agent's call, from the builder check]** |
| `severity` | real | 0..1, set by the source adapter (§7) |
| `occurred_at` | text | ISO 8601 |
| `raw` | text | Original payload as JSON, kept for debugging and audit |

### 6.2 User

`id`, `name`, `email`, `home_country` (ISO2), `is_admin`.

### 6.3 Channel subscription (per user)

`id`, `user_id`, `type` (`email` | `slack`), `config` (JSON, validated by the adapter's zod schema), `enabled`.
- email config: `{ to: string }` (defaults to the user's email)
- slack config: `{ webhookUrl: string }` (a Slack Incoming Webhook). **Treat it as a secret:** mask it in API responses and never log it. **[agent's call]**

### 6.4 Alert rule (per user)

`id`, `user_id`, `name`, `categories` (JSON array, empty = all), `keywords` (JSON array, case-insensitive match on title + summary, empty = any), `threshold` (0..1, default `0.5`), `channel_ids` (JSON array of the user's subscriptions), `enabled`.

Rules match on category, keywords and importance. Region is **not** a filter here; it feeds into the score instead. A user who wants "Nepal only" can lower the threshold and add a keyword. A dedicated region filter is a later extension.

### 6.5 Delivery (the outbox)

`id`, `rule_id`, `event_id`, `channel_id`, `status` (`pending` | `sent` | `failed`), `attempts`, `last_error`, `score`, `score_breakdown` (JSON), `created_at`, `sent_at`.
`UNIQUE(event_id, channel_id)` means a user never gets the same event twice on the same channel, even if two of their rules match it. **[agent's call]**

### 6.6 Source

`id`, `type`, `name`, `config` (JSON), `enabled`, `poll_interval_s`, `last_polled_at`, `last_error`. Admins can toggle `enabled`.

## 7. Sources and severity mapping

All three feeds were **checked on 2026-10-19 with live requests** before they went into this design (D-008). The raw responses are saved in [`docs/evidence/feed-probes-2026-10-19/`](../../evidence/feed-probes-2026-10-19/) and reused as test fixtures.

| Category | Source | Endpoint | Country / scope | Severity |
|---|---|---|---|---|
| disaster | **GDACS** RSS | `https://www.gdacs.org/xml/rss.xml` | `gdacs:iso3` converted to ISO2. Empty `iso3` (3 of 225 items in the probe) → `scope = unknown` | Alert level: Green 0.3, Orange 0.7, Red 1.0 |
| market | **CoinGecko** simple price | `/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true` | `scope = global` | `min(1, abs(24h change %) / 6)`: 3% gives 0.5, 4% gives 0.67, 5.4%+ gives 0.9+ (critical) **[proposed, Q1]** |
| news | **RSS** feeds, each configured with a country or as global | e.g. `telex.hu/rss` (HU), `hvg.hu/rss` (HU), `feeds.bbci.co.uk/news/world/rss.xml` (global) | The feed's configured country, or `scope = global` | Base 0.5. **0.8** if the title contains a "breaking" keyword from a short configured list **[proposed, Q1]** |

**GDACS escalation [agent's call, from the builder check]:** `external_id = <eventid>:<alertlevel>`. A rise from Green to Orange to Red creates a new event row, so it gets scored again and can alert. A re-poll at the same level is ignored. The most a user can receive for one disaster is three alerts, one per level; in practice Green almost never passes the threshold.
| any | **manual** (admin inject) | — | Admin's choice | Admin's choice |

**Rejected:**
- USGS earthquakes: 3 of 26 events had no parseable country.
- Frankfurter FX: the endpoint now returns a 301 redirect.

**Known weakness:** news severity is crude, because RSS carries no importance signal. That is acceptable for v1 and noted as a shortcut in the code. The obvious upgrade is LLM scoring, which is a non-goal for v1.

**Market events:** emit an event only when `abs(change) ≥ 3%`, and at most once per coin per UTC day (`external_id = coin:YYYY-MM-DD`). **[agent's call]**

**GDACS noise:** wildfire Green alerts are about 85% of the feed. They're kept, because the threshold handles them: Green 0.3 never passes the 0.5 default threshold.

Polling runs on an in-process `setInterval` per source (default 5 minutes). **[agent's call]** There's no external queue.

## 8. Importance score [user: region priority; really important far-away events must still pass by default]

> **Revised after the builder check.** The first draft's weights let almost nothing except GDACS Red through: by default no news and no market event would ever alert. That broke the user's requirement. The values marked **[proposed, Q1]** are the fix and are waiting for the user's OK.

```
proximity = 1.0   scope=country and event.country == user.home_country
            0.75  scope=country, same UN M49 sub-region          (HU & PL & RO: Eastern Europe; AT is Western Europe)   [proposed, Q1]
            0.4   scope=country, same continent
            0.2   scope=country, elsewhere
            0.8   scope=global  (markets, world-news feeds)                                                         [proposed, Q1]
            0.2   scope=unknown (treated as far away)

importance = severity × proximity
if severity ≥ 0.9:  importance = max(importance, severity)      # critical override: "really important" reaches everyone [user requirement]

fires if  importance ≥ rule.threshold  (default 0.5)  AND category & keyword match
```

**Worked examples (user in HU, default threshold 0.5). Each row becomes a unit test:**

| Event | severity | proximity | importance | Result |
|---|---|---|---|---|
| HU news, normal | 0.5 | 1.0 | 0.50 | sent |
| Nepal news, normal | 0.5 | 0.2 | 0.10 | dropped |
| Nepal news, breaking | 0.8 | 0.2 | 0.16 | dropped |
| BBC world news, normal | 0.5 | 0.8 (global) | 0.40 | dropped |
| BBC world news, breaking | 0.8 | 0.8 (global) | 0.64 | sent |
| GDACS Red quake in Nepal | 1.0 | 0.2 | 0.20 → **1.0** (override) | sent |
| GDACS Orange flood in Romania | 0.7 | 0.75 (same sub-region) | 0.525 | sent |
| GDACS Orange flood in Spain | 0.7 | 0.4 (continent) | 0.28 | dropped |
| GDACS Orange quake at sea (no country) | 0.7 | 0.2 (unknown) | 0.14 | dropped |
| BTC −3% | 0.5 | 0.8 (global) | 0.40 | dropped |
| BTC −4% | 0.67 | 0.8 (global) | 0.53 | sent |
| BTC −6% | 1.0 | 0.8 (global) | 0.80 → **1.0** (override) | sent |

`score_breakdown` stores `{severity, proximity, proximityReason, override, threshold}` for every delivery. The admin view shows it.

**Region data:** a static JSON map of ISO2 → `{ iso3, subregion, continent }` from the UN M49 classification. **[builder]** Pick the source, but it has to be an authoritative dataset (UN M49 CSV or a well-known package such as `world-countries`). The table must not be typed out by the AI from memory: spot-check at least HU, NP, RO, AT and US against the source.

**The weights and the critical override are tunable constants in one file, with unit tests for every row of the table above.**

## 9. Pipeline

```
poller (per source) ──► adapter.fetch() ──► normalize ──► INSERT OR IGNORE events
                                                              │ (new rows only)
                                                              ▼
                                                    matcher: for each enabled rule
                                                    → category/keyword match
                                                    → score(event, rule.user)
                                                    → if fires: INSERT OR IGNORE delivery(pending)
                                                              ▼
                                         dispatcher (interval, 10s): pending deliveries
                                                    → channelRegistry[type].send()
                                                    → sent | retry (attempts < 3, backoff) | failed
```

- The matcher only runs on **newly inserted** events. Re-polling the same feed is harmless.
- Admin "inject event" goes through the same `normalize → insert → matcher` path. There's no separate demo shortcut.
- Admin "retry" on a failed delivery resets it to `pending`.

## 10. Channel adapter interface [user: extensible]

```ts
interface ChannelAdapter<C> {
  type: string;                       // 'email' | 'slack' | ...
  configSchema: z.ZodType<C>;         // validated on subscription create/update
  maskConfig(config: C): unknown;     // what the API may return (secrets hidden)
  send(config: C, msg: AlertMessage): Promise<void>;   // throw on failure
}
```

`AlertMessage = { title, summary, url, category, country, importance, reason }`. Registry = a plain object keyed by `type`. Adding a channel means writing one file plus one registry line, and nothing else changes.

- **email:** `nodemailer`. If `SMTP_URL` is set, it sends through it. Otherwise it uses **`jsonTransport` and writes each message to the log and to `data/outbox/*.json`**, so it works with zero setup. Mailpit is an optional upgrade, documented in the README. **[agent's call]**
- **slack:** POST `{ text, blocks }` to the webhook URL. A non-2xx response counts as a failure. Without a real webhook, a `SLACK_DRY_RUN=1` mode logs the message instead. **[agent's call]**

## 11. API (Fastify, JSON, zod-validated)

"Current user" = `X-User-Id` header, set by the UI's user switcher. **[agent's call]** Admin routes check `is_admin`. This shortcut is deliberate and documented. It is not security.

User:
- `GET /api/me`
- `GET|POST|PATCH|DELETE /api/rules`
- `GET|POST|PATCH|DELETE /api/channels` (configs masked)
- `POST /api/channels/:id/test` (sends a sample alert through the adapter right away, skipping the outbox)
- `GET /api/my/deliveries` (alert history)

Admin:
- `GET /api/admin/users`, `GET /api/admin/rules`
- `GET /api/admin/events`
- `GET /api/admin/deliveries?status=` and `POST /api/admin/deliveries/:id/retry`
- `GET /api/admin/sources` and `PATCH /api/admin/sources/:id` (enable, interval) and `POST /api/admin/sources/:id/poll`
- `POST /api/admin/events` (inject)

## 12. Frontend [user: React + Vite + RTK Query + shadcn/Radix + Tailwind]

- **User area:** "My alerts" (rule list and form: categories, keywords, threshold slider, channels), "Channels" (add email or Slack, send test), "History" (my deliveries with the score breakdown).
- **Admin area:** tabs for Users, Rules, Events, Deliveries (status filter, retry, breakdown), Sources (toggle, poll now, last error), plus an "Inject event" dialog.
- Header: a user switcher (seeded users, including one admin). A single RTK Query `api` slice with tag invalidation.
- shadcn defaults, with no custom theme work.

## 13. Repo layout [agent's call]

```
server/   Fastify app, db (schema.sql + migrations-by-hand), sources/, channels/, scoring/, pipeline/
web/      Vite React app
docs/     task brief, decisions, design, plan, verification notes, AI review log
prompts/  prompt history
```

npm workspaces (no extra monorepo tool). `npm install && npm run dev` starts both. `npm test` runs all tests.

## 14. Verification strategy (the part the graders care about)

- **Unit tests (vitest):** the scoring table (§8), each source adapter's `normalize` on **saved real payloads** (the fixtures captured on 2026-10-19), the keyword/category matcher, and the zod schemas of the channel adapters.
- **Integration test:** inject event → delivery rows → dispatcher with a fake adapter → status `sent`. Also check dedup (inject twice gives one delivery) and retry (a failing adapter gives `failed` after 3 attempts).
- **Manual end-to-end checks with evidence:** a real Slack webhook if one is available, the email outbox file, and Playwright screenshots of the user and admin views, saved to `docs/evidence/`.
- **AI review log** ([`docs/ai-review-log.md`](../../ai-review-log.md)): every AI output that was rejected, corrected or doubted, with how it was caught.
- Every merge to `main` needs green tests and a reviewer pass by a subagent (`superpowers:requesting-code-review`). Its findings are triaged in writing.

## 15. Left to the builder

- Exact table DDL, indexes, migration mechanics
- Which UN M49 dataset to use (must be authoritative, §8)
- The RSS parsing library (or a minimal parser), and the HTML stripping in summaries
- Backoff timings
- The exact message formatting for email and Slack
- UI layout details within shadcn defaults
