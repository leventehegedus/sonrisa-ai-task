# How to Test the Current State (after M2)

> **The web UI is done now.** For the browser walkthrough and the requirements checklist, see [`testing-walkthrough.md`](testing-walkthrough.md). This page stays as the curl/API-level guide.

**What exists:** the core engine (M1) and the HTTP API (M2), both merged to `main`. **No web UI yet** (M3). For now you test through the automated tests and `curl`.

All commands run from the repo root. Requires Node 24.

## 1. Automated tests (about 2 s)

```bash
npm install
npm test                      # expected: Test Files 13 passed, Tests 214 passed
npm run typecheck -w server   # expected: no output, exit code 0
```

| Test file | What it proves |
|---|---|
| `scoring.test.ts` | the 12 worked examples from design §8 (region weights, critical override) |
| `sources.test.ts` | GDACS / RSS / CoinGecko parsing against **real** feed responses saved on 2026-10-19 |
| `ingest.test.ts` | dedup, scoring per user, no cross-user delivery, 24 h backfill guard |
| `channels.test.ts` | email outbox, Slack payload, secret masking, path-traversal safety |
| `dispatch.test.ts` | retry 30 s → 60 s → failed, permanent failures, no duplicate send |
| `poll.test.ts` | broken feeds isolated, first-poll baseline, scheduler never overlaps |
| `chain.test.ts` | the full chain: feed body → poll → ingest → dispatch → email file |
| `api-user.test.ts`, `api-admin.test.ts` | every route: status codes, ownership (404 for other users' data), admin-only (403), validation (400, nothing written), secrets never returned |

## 2. Run the server against live feeds

```bash
npm run dev -w server
# → [time] World Alerts API on http://127.0.0.1:3000
```

- It creates `data/alerts.db` and seeds 3 users:
  - **1 Anna** (HU, admin)
  - **2 Bence** (HU)
  - **3 Priya** (NP)
- It also seeds 5 sources: GDACS, CoinGecko, Telex, HVG, BBC World.
- Within about 10 s it polls every source. The first poll is a **baseline**: events are stored, but no alerts are sent for news that already exists.
- To start fresh: stop the server, then `rm -rf data/`.

In a second terminal (identity = the `X-User-Id` header; this is a dev shortcut, not real auth):

```bash
# Who am I?
curl -s localhost:3000/api/me -H 'X-User-Id: 1'

# Did every source poll? Look at lastError (null = ok) and baselineAt
curl -s localhost:3000/api/admin/sources -H 'X-User-Id: 1'

# Inject a test event: a Hungarian flood, severity 0.6
curl -s -X POST localhost:3000/api/admin/events -H 'X-User-Id: 1' \
  -H 'content-type: application/json' \
  -d '{"category":"disaster","title":"Test flood in Budapest","country":"HU","severity":0.6}'
#   → "deliveriesCreated": 2   (Anna + Bence are in HU; Priya in NP scores 0.12 → no alert)

# Wait about 10 s for the dispatcher, then:
curl -s localhost:3000/api/my/deliveries -H 'X-User-Id: 2'   # Bence: status "sent", with the score breakdown
curl -s localhost:3000/api/my/deliveries -H 'X-User-Id: 3'   # Priya: []
ls data/outbox/                                              # one JSON "email" per recipient

# A critical far-away event reaches everyone (critical override)
curl -s -X POST localhost:3000/api/admin/events -H 'X-User-Id: 1' \
  -H 'content-type: application/json' \
  -d '{"category":"disaster","title":"Major earthquake in Nepal","country":"NP","severity":1}'
#   → "deliveriesCreated": 3

# Access control
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin/users -H 'X-User-Id: 2'   # 403 (not admin)
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/me                              # 401 (no identity)

# Admin views
curl -s 'localhost:3000/api/admin/deliveries?status=sent' -H 'X-User-Id: 1'
curl -s 'localhost:3000/api/admin/events?limit=5' -H 'X-User-Id: 1'
```

**Verified on 2026-10-19:** this exact sequence ran against live feeds. All 5 sources polled with no error, the HU inject created 2 deliveries, Bence's was `sent`, Priya's list was empty, the non-admin call got 403, and both outbox files were written. An earlier run is recorded in [`evidence/m2-api-smoke.md`](evidence/m2-api-smoke.md).

## 3. Rules and channels (as a normal user)

```bash
# Bence lowers his threshold, so global market or news events reach him more easily
curl -s localhost:3000/api/rules -H 'X-User-Id: 2'                  # find his rule id
curl -s -X PATCH localhost:3000/api/rules/2 -H 'X-User-Id: 2' \
  -H 'content-type: application/json' -d '{"threshold":0.3}'

# Validation: out-of-range input is rejected and nothing is written
curl -s -X PATCH localhost:3000/api/rules/2 -H 'X-User-Id: 2' \
  -H 'content-type: application/json' -d '{"threshold":1.5}'        # 400

# Send a test message through a channel
curl -s localhost:3000/api/channels -H 'X-User-Id: 2'               # find the channel id
curl -s -X POST localhost:3000/api/channels/2/test -H 'X-User-Id: 2' # {"ok":true} + a file in data/outbox
```

## 4. Real Slack (optional)

1. Create a Slack **Incoming Webhook** (`https://hooks.slack.com/services/...`).
2. Start from a fresh DB, with real sending turned on:

```bash
rm -rf data/
SEED_SLACK_WEBHOOK='https://hooks.slack.com/services/XXX/YYY/ZZZ' SLACK_DRY_RUN=0 npm run dev -w server
```

3. Bence (user 2) now also has a Slack channel. Inject an event as above, and the message arrives in Slack.

The API only ever shows the webhook masked (`https://hooks.slack.com/…/ZZZZ`). Real Slack delivery has **not** been tested yet; only dry-run mode and mocked requests have.

## 5. Real email (optional)

Set `SMTP_URL` (for example `smtp://user:pass@smtp.example.com:587`) before starting. Without it, emails go to `data/outbox/*.json`.

## What you can't test yet

- The web UI: M3, Tasks 11–13, not started (two interrupted attempts were preserved as patches).
- Screenshots, the verification report and the README quick start: M4, Task 14.
