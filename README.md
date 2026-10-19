# World Alerts

Users get notified by email and/or Slack when something important happens in the world (news, markets, natural disasters). Events come from real free feeds plus an admin "inject event" button. Whether an event is "important" is decided by a transparent, region-weighted score, and every delivery records why it fired.

## Quick start

Requires Node 24.

```bash
npm install && npm run dev
```

Open http://localhost:5173. The API runs on http://127.0.0.1:3000. A seeded user switcher stands in for login:

| User | Home | Role |
|---|---|---|
| Anna | HU | admin |
| Bence | HU | user |
| Priya | NP | user |

Emails are written as JSON files to `data/outbox/` unless `SMTP_URL` is set. Admins can inject a test event (Admin tab, "Inject event"), so a demo never depends on live news.

## How scoring works

- `proximity` is 1.0 for the user's home country, 0.75 same UN M49 sub-region, 0.4 same continent, 0.2 elsewhere, 0.8 for global events (markets, world news).
- `importance = severity x proximity`.
- Critical override: if `severity >= 0.9`, `importance = max(importance, severity)`, so really important far-away events still reach everyone.
- A rule fires if `importance >= threshold` (default 0.5) and its category and keywords match.
- The breakdown is stored on each delivery and shown in the UI. Full table: design spec section 8.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | API port |
| `DB_PATH` | `data/alerts.db` | SQLite file |
| `SMTP_URL` | unset | e.g. `smtp://user:pass@host:587`; unset = write emails to `data/outbox/` |
| `SMTP_FROM` | `World Alerts <alerts@world-alerts.local>` | From address of alert emails; strict providers need a verified sender |
| `SLACK_DRY_RUN` | `1` | `0` = really post to Slack; otherwise Slack messages are only logged |
| `SEED_SLACK_WEBHOOK` | unset | gives Bence (user 2) a Slack channel with this webhook (fresh DB only) |
| `API_TARGET` | `http://localhost:3000` | web dev server: where `/api` is proxied |

Variables can also go in a repo-root `.env` (git-ignored; copy `.env.example`). Real environment variables win over `.env`.

### Real email

By default emails are written to `data/outbox/` and nobody is mailed. To send real email, set `SMTP_URL` (and optionally `SMTP_FROM`) in a git-ignored `.env`, restart, add your address under **Channels**, and press **Send test**.

See **[docs/email-setup.md](docs/email-setup.md)** for the full step-by-step guide: Gmail App password, other providers, local Mailpit, troubleshooting and security.

## Commands

```bash
npm test                  # server + web unit/integration tests
npm run typecheck         # server typecheck
npm run build -w web      # type-check and build the web app
npm run e2e               # Playwright walkthrough on an isolated stack (:3002 / :5175), rewrites docs/evidence/screenshots/e2e/
```

## Architecture

```
 feeds (GDACS, CoinGecko, Telex, HVG, BBC)          admin "inject event"
            |                                              |
            v                                              v
   scheduler/poll --> normalize --> ingest (dedup, match rules, score) --> deliveries (SQLite)
                                                                              |
                                                                    dispatcher (retry 30s, 60s)
                                                                              |
                                                          channel adapters: email | slack | (one file each)

 web (React + Vite + RTK Query) --/api--> Fastify API (zod) --> SQLite (better-sqlite3)
```

## How this was built

The project is graded on process, so the trail is kept in the repo.

- [Plan](docs/plan.md) and [design spec](docs/superpowers/specs/2026-10-19-world-alerts-design.md)
- [Decisions](docs/decisions.md)
- [AI review log](docs/ai-review-log.md): AI output that was rejected, corrected or doubted
- [Progress summary](docs/progress-summary.md)
- [How to test](docs/how-to-test.md) and [verification report](docs/verification.md)
- [Prompts](prompts/): every prompt given to the agent
- [SDD archive](docs/sdd-archive/): task briefs, reports and reviews per milestone
