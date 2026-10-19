# Progress Summary

> **Update 2026-10-20: all milestones are complete (M1–M4).** See §5 at the end for the final state. §§1–4 below describe M1 as written after that milestone.

# After Milestone 1

**Date:** 2026-10-19 · **State of `main`:** M1 (core engine) merged, plus fix B1. 140/140 tests pass and the typecheck is clean.
**Not built yet:** the HTTP API (M2), the web UI (M3), the end-to-end evidence and README (M4).

This document explains what exists today, how it works, and why it's built that way. It also covers how it was checked.

---

## 1. The big picture

```
 ┌──────────── sources ────────────┐
 │ GDACS (disasters)   RSS (news)  │   every 5 min, polled by the scheduler
 │ CoinGecko (markets) manual      │
 └──────────────┬──────────────────┘
                ▼  normalize → one common "event" shape
          ┌───────────┐
          │  ingest   │  store the event (dedup) → for each user's rule:
          └─────┬─────┘  match? → score (severity × region proximity) → fires?
                ▼
          ┌───────────┐
          │ deliveries│  the "outbox": one row per (event, channel), status pending
          └─────┬─────┘
                ▼  dispatcher, every 10 s
          ┌───────────┐
          │ channels  │  email (file outbox or SMTP) · Slack (webhook)
          └───────────┘
```

The engine has no web server yet. Every stage is a plain function that takes the database and an injected clock (`now`). That's why all of it can be tested quickly and deterministically, without a network or timers.

## 2. What each part does

### 2.1 Database (`server/src/db/`)
- SQLite through `better-sqlite3`, using plain SQL with no ORM. There are six tables: `users`, `channels`, `rules`, `events`, `deliveries`, `sources`.
- **Dedup is enforced by the database itself:**
  - `UNIQUE(source, external_id)` on events, so re-polling a feed never duplicates an event.
  - `UNIQUE(event_id, channel_id)` on deliveries, so a user never gets the same event twice on one channel, even if two of their rules match.
- **Deleting a channel or rule keeps the delivery history** (`ON DELETE SET NULL`). The audit trail survives, and the dispatcher marks orphaned deliveries as failed.
- `rows.ts` converts database rows (snake_case, JSON text) into typed objects in one place.

### 2.2 Country regions and scoring (`geo/`, `scoring/`)
This implements your requirement that **region gives priority**.

- Each event gets a **severity** from 0 to 1, set by its source.
- Each user has a **home country**. Proximity weights:

| Where the event is | Weight |
|---|---|
| Home country | 1.0 |
| Same UN sub-region (e.g. HU and RO are both "Eastern Europe") | 0.75 |
| Same continent | 0.4 |
| Elsewhere | 0.2 |
| Global (markets, world news) | 0.8 |
| Unknown location (e.g. a quake at sea) | 0.2 |

- `importance = severity × weight`. **Critical override:** severity ≥ 0.9 always passes, so a really important far-away event reaches you by default (your requirement).
- A rule fires when `importance ≥ threshold` (default 0.5).
- Every delivery stores the full breakdown, so you can always see *why* it was sent. For example: `importance 0.53 = severity 0.67 × 0.8 (global) ≥ threshold 0.5`.
- **The region data is real, not AI-written.** It's the UN M49 table, checked against the UN's own page: 248 countries, 0 mismatches. An npm package the AI first suggested turned out not to follow M49, and would have flipped one of your approved examples (R-009).
- The weights live in one file (`weights.ts`). All 12 worked examples from the design are unit tests.

### 2.3 Rules (`matching/`)
- A rule has categories (news / market / disaster; empty means all), keywords, a threshold and target channels.
- Keyword matching ignores case and handles Hungarian letters (`árvíz` matches `ÁRVÍZ`). It's plain text search, never a regex, so keywords like `(BTC)` or `c++` can't break or exploit it.

### 2.4 Sources (`sources/`)
Each source has one small adapter that turns a raw feed into events.

| Source | What it gives | Severity |
|---|---|---|
| **GDACS** (UN-backed disaster alerts) | earthquakes, floods, cyclones, wildfires, droughts, each with a country | Green 0.3 · Orange 0.7 · Red 1.0 |
| **RSS** news | telex.hu and hvg.hu tagged Hungary; BBC World tagged global | 0.5, or 0.8 when the title contains "breaking"-type keywords |
| **CoinGecko** | BTC and ETH 24-hour price change | `abs(change %) / 6`, so 3% gives 0.5 and 6%+ is critical |
| **Manual** | the admin's "inject test event" | whatever the admin sets |

- The tests run against **real responses saved on 2026-10-19**, not invented samples.
- **Escalation:**
  - A GDACS event that rises from Green to Orange to Red creates a new event at each level, so it can alert again.
  - A market move that grows from 3% to 4% to 6%+ on the same day does the same.
- **Safety:**
  - Only `http(s)` links are accepted, so a `javascript:` link from a feed or the inject form can't become a clickable link.
  - Unknown alert levels are rejected.
  - An unreadable feed body produces no events at all, never partial ones.

### 2.5 Ingest (`pipeline/ingest.ts`)
- Stores new events in one transaction, then checks every enabled rule against each **newly stored** event, and writes a `pending` delivery for each enabled channel the rule's owner has.
- A rule can never deliver to **another user's** channel.
- **Backfill guard:**
  - The first successful poll of a source only records a baseline.
  - Events older than 24 hours never alert.
  - Without this, the first start sent about 111 alerts per Hungarian user for old news (R-012).

### 2.6 Channels (`channels/`)
- One interface, `ChannelAdapter`, with exactly two adapters: **email** and **Slack**. Adding Teams or SMS later means one new adapter file and one registry line.
- **Email:**
  - With no SMTP configured, each message is written as a JSON file to `data/outbox/` and logged, so it works with zero setup.
  - With `SMTP_URL` set, it sends for real.
- **Slack:**
  - Posts to an Incoming Webhook, with a 10-second timeout.
  - Feed text is escaped, so a malicious headline can't ping `@channel` or show a disguised link (R-013).
  - A dry-run mode logs the message instead of sending it.
- **Secrets:** the webhook URL is masked in anything the API returns (only the last 4 characters show) and scrubbed from error messages.

### 2.7 Dispatcher (`pipeline/dispatch.ts`)
- Every 10 seconds it sends up to 50 due deliveries, one at a time.
- **Success** → `sent`.
- **Temporary failure** → retry after 30 seconds, then after 60 seconds, then `failed` after 3 attempts.
- **Permanent problems fail immediately, without retrying:**
  - the channel was deleted or disabled
  - the channel type is unknown
  - the channel config is invalid
  - the stored data is corrupt
- **Known limit:** delivery is *at-least-once*. If the status write fails right after a successful send, the alert may be sent again. This is documented as a `shortcut:` in the code.

### 2.8 Polling and scheduler (`pipeline/poll.ts`, `scheduler.ts`)
- Each source is polled when it's due (default every 5 minutes), with a 15-second timeout.
- **A broken feed never stops the others.** Its error is stored on the source (shown in the admin view later), and the scheduler keeps going.
- Only one scheduler run at a time, so a slow feed can't cause overlapping runs. A failing logger can't crash the process.

## 3. How it was built and checked

The plan was run **subagent-driven**: a fresh AI implementer wrote each task, then a **separate, fresh AI reviewer** checked it against the spec. The controlling session only wrote the task briefs and made decisions; it never wrote product code. All the briefs, reports, reviews and diffs are archived in [`sdd-archive/M1-core-engine/`](sdd-archive/M1-core-engine/).

**What the reviews caught.** "Looked done" was not the same as "was right":

| Where | Problem caught | How |
|---|---|---|
| Task 3 | The "failing test" evidence never actually ran a test | The reviewer read the evidence, then broke the code on purpose to prove the tests catch it |
| Task 4 | A GDACS level named `constructor` slipped past validation | The reviewer wrote a probe |
| Task 4 | `javascript:` URLs were accepted | probe |
| Task 6 | Two emails within the same millisecond overwrote each other | review |
| Task 6 | The path-traversal tests passed even with the protection deleted | review |
| Task 7 | A database hiccup could cause the same alert to be sent twice | review |
| M1 review | First start floods users with about 111 old alerts | an end-to-end probe on a fresh DB |
| M1 review | **My own design error:** "one market event per day", so a later crash never alerted | probe: −3.1% then −8% gave 0 alerts |
| M1 review | Slack markup injection from headlines | probe |
| Re-review | The flood fix was incomplete when the very first poll fails | review |

Every fix was re-checked by another fresh reviewer. Full list: [`ai-review-log.md`](ai-review-log.md) (R-001..R-017).

**Decisions made on your behalf** are marked *(Agent's call)* in [`decisions.md`](decisions.md). The main ones from M1:
- market escalation bands (D-017)
- the first-poll baseline and the 24-hour cutoff (D-017)
- channel type checked in code, not as a DB constraint (D-017)
- the B1 fix on its own branch (D-018)

## 4. What's next

| Milestone | Tasks | What you'll be able to do |
|---|---|---|
| **M2 API** | 9–10 | Run the server: user routes (rules, channels, history, "send test"), admin routes (events, deliveries + retry, sources + poll now, inject event), seed users |
| **M3 Web** | 11–13 | Use the app in a browser: My alerts, Channels, History, Admin tabs, inject dialog (React, RTK Query, shadcn) |
| **M4 Evidence** | 14 | Screenshots, a verification report (each goal → proof → result), README with one-command start |

**About the interruption:** Task 9 had started when it was stopped. Its partial, unreviewed work is saved in [`sdd-archive/M2-api/interrupted-task-9-partial.patch`](sdd-archive/M2-api/interrupted-task-9-partial.patch) (and in git stash). Task 9 restarts from a clean tree.


## 5. Final state (2026-10-20)

| Milestone | What it delivered | Merged |
|---|---|---|
| M1 Core engine | sources, scoring, ingest, channels, dispatcher, scheduler | `af9995a`, fix B1 `8a9ed68` |
| M2 HTTP API | user and admin routes, seed, `main.ts`, real smoke run | `a785991` |
| M3 Web UI | Vite + React + RTK Query + shadcn/Radix: user switcher, My alerts, Channels, History, Admin (users, rules, events, deliveries + retry, sources, inject) | `ad51de4`, flake fix `6215f2a` |
| M4 Evidence | Playwright e2e flow with 6 screenshots, [`verification.md`](verification.md), README | this merge |

- **Tests:** server 215, web 25, e2e 1 flow. `npm test` and `npm run e2e`.
- **Real-browser check:** the M3 whole-branch reviewer drove Chromium via Playwright. Screenshots are in [`evidence/screenshots/`](evidence/screenshots/).
- **Not verified:** real Slack and real SMTP delivery (dry-run and mocks only), other browsers, a fresh-machine install. See [`verification.md`](verification.md).
- **Review catches across the whole project:** R-001..R-023 in [`ai-review-log.md`](ai-review-log.md).
