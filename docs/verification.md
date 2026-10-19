# Verification report

Goals and anti-goals are from [design spec](superpowers/specs/2026-10-19-world-alerts-design.md) sections 2 and 4. Run on 2026-10-20. Commands run from the repo root.

- `npm test`: server 13 files / 215 tests passed; web 5 files / 25 tests passed. The tab-fallback flake found during this task is fixed (see "Flake (fixed)" below).
- `npm run build -w web`: passed.
- `npm run e2e`: 1 test passed, 6 screenshots written to [`evidence/screenshots/e2e/`](evidence/screenshots/e2e/).

The e2e run is isolated: API on :3002 with a throwaway DB under `/tmp/world-alerts-e2e`, web on :5175. Because the server always writes emails to repo-root `data/outbox/`, the spec records the files that existed before and deletes only the ones it created.

## Goals (spec section 2)

| # | Goal | How verified | Result |
|---|---|---|---|
| 1 | Rules, notified by email and/or Slack | Email: `channels.test.ts` "writes one JSON file in outbox containing the title"; `chain.test.ts` full chain feed -> poll -> ingest -> dispatch -> email file; `dispatch.test.ts` "sends a due delivery and marks it sent". Rules/channels UI: [screenshot 1](evidence/screenshots/e2e/1-my-alerts.png), [2](evidence/screenshots/e2e/2-channels.png); toast "Test sent" in the e2e run. Real run on live feeds: [m2-api-smoke.md](evidence/m2-api-smoke.md), [how-to-test.md](how-to-test.md) section 2 (outbox files written, Bence's delivery `sent`). Slack: `channels.test.ts` slack tests with mocked `fetch` ("posts { text } once to the url", "dry-run logs and does not fetch"). | Email: pass. Slack: dry-run and mocked fetch only; **real delivery not tested** |
| 2 | Real free feeds + inject button | `sources.test.ts` parses GDACS / RSS / CoinGecko against real payloads saved 2026-10-19 ([feed probes](evidence/feed-probes-2026-10-19/)); m2 smoke: all 5 sources polled with no error. Inject: `api-admin.test.ts` "HU severity 0.6 ...", "Red severity 1.0 in NP ..."; e2e injects HU 0.6 -> toast "2 deliveries created", NP 1.0 -> "3 deliveries created" ([screenshot 6](evidence/screenshots/e2e/6-inject-dialog.png)). | Pass |
| 3 | Transparent region-weighted score, reason recorded | `scoring.test.ts` (the 12 worked examples of spec section 8); `ingest.test.ts` creates a scored delivery; breakdown shown in [screenshot 4](evidence/screenshots/e2e/4-admin-deliveries.png) ("0.60 x 1.00 (home) = 0.60", "critical override" badge) and [3](evidence/screenshots/e2e/3-history.png). M49 data: [m49-check](evidence/m49-check/). | Pass |
| 4 | New channel = one adapter file | Adapter interface and registry (`server/src/channels/`); `channels.test.ts` and `dispatch.test.ts` drive email and Slack, and a fake adapter, through the same interface. No test adds a third channel. | Partial: structure and fake-adapter tests; no real third adapter written |
| 5 | Admin view: users, rules, events, deliveries with retry, source switches | API: `api-admin.test.ts` (users, rules, events, deliveries, "retry: failed -> pending ...", sources PATCH/poll); UI: `web/src/pages/admin/admin.test.tsx`; e2e: [screenshot 4](evidence/screenshots/e2e/4-admin-deliveries.png) (deliveries), [5](evidence/screenshots/e2e/5-admin-sources.png) (5 sources with switches). Admin tab absent for Bence: asserted in e2e and `AppShell.test.tsx`. | Pass. Retry button was tested in unit tests only, not clicked in e2e (no failed delivery arises in the run) |
| 6 | One install, one start, no Docker or keys | `npm install && npm run dev` run in M3 ([m3-web-connection.md](evidence/m3-web-connection.md)); e2e starts both servers with the same scripts. | Pass on this machine (macOS, Node 24); not tried on a clean machine |

## Anti-goals (spec section 4)

| Anti-goal | How verified | Result |
|---|---|---|
| UI with no visible reasoning | Score breakdown (`ScoreBreakdown.test.tsx`, screenshots 3 and 4) | Not violated |
| Alerts with no explanation | `ingest.test.ts` stores the breakdown; `api-admin.test.ts` deliveries shape; screenshots 3 and 4 | Not violated |
| Duplicate delivery to a user on a channel | `ingest.test.ts` "re-ingesting the same event inserts nothing and keeps one delivery", "two rules matching on the same channel give one delivery"; `dispatch.test.ts` "does not retry (no duplicate send) when marking sent fails after a successful send" | Not violated |
| Demo that depends on live news | Inject button; e2e asserts only on injected events, never on live feed content; `poll.test.ts` first poll is a baseline | Not violated |
| Secrets in logs, API, git | `channels.test.ts` "throws on 500 without leaking the webhook url", `scrubSecrets`, "masks to last 4 chars only"; `api-user.test.ts` "GET /api/channels never contains the webhook secret"; `dispatch.test.ts` "stores error messages scrubbed of the webhook url"; `api-admin.test.ts` deliveries "never leaks a Slack webhook" | Not violated in tests. No git-history secret scan was run |
| AI code merged without a test or manual check | Per-task reports and reviews in [sdd-archive](sdd-archive/); [ai-review-log.md](ai-review-log.md) | Process claim; see those documents |

## Not verified

- **Real Slack delivery.** No webhook was available. Slack was verified only in dry-run mode and in unit tests with mocked `fetch`. The sequence to try is in [how-to-test.md](how-to-test.md) section 4.
- Delivery status `sent` in the browser: the e2e screenshots were taken right after injection, so deliveries show `pending` (the dispatcher runs about every 10 s). `sent` was verified by `dispatch.test.ts`, `chain.test.ts` and the curl run in [m2-api-smoke.md](evidence/m2-api-smoke.md).
- Retry button click in a browser, and the failed-delivery path with a real failing channel.
- Live feed content in the e2e run (deliberately not asserted); feed formats may change.
- Browsers other than Chromium, and mobile layouts.
- A fresh machine install; no security scan of git history.
- Security: there is no real authentication (the `X-User-Id` header is a dev shortcut, API bound to 127.0.0.1).

## Flake (fixed)

`web/src/components/AppShell.test.tsx` "falls back to My alerts when the active Admin tab disappears…" failed in 2 of 6 runs when this task first ran it. The controller reproduced it in 4 of 6.

**Root cause:** a race. After a user switch, `me` is briefly undefined, and the test read `aria-selected` once. It also exposed a real UI glitch: a brief blank panel, and "Loading…" forever when `/me` failed.

**Fixed** on `fix/appshell-tab-flake` (commits `a1ae670`, `b63201c`):
- The UI renders the tabs only once `me` is loaded, and shows "Could not load your session." on error.
- The test waits for the new user's data and retries the assertions.

Then: 10/10 and 8/8 consecutive green runs, plus a new error-state test. See R-023 in [`ai-review-log.md`](ai-review-log.md).


## Real email delivery (verified 2026-10-20)

1. **Throwaway SMTP server.** The Ethereal check returned `{"ok":true}` and `250 Accepted` ([`evidence/smtp-ethereal-check.md`](evidence/smtp-ethereal-check.md)).
2. **Real Gmail, end to end.** The user created a Gmail App password, which was stored only in the git-ignored `.env`.
   - Setup: an isolated API instance (`PORT=3004`, temp DB) loaded `.env`. As user 1, an email channel was created with the user's own address, then `POST /api/channels/4/test` returned `{"ok":true}`.
   - The agent then searched the user's mailbox **read-only** through the Gmail connector. The message `[World Alerts] World Alerts test message` was in the **INBOX**, received 2026-10-19T23:18:22Z, with the body "This is a test alert sent from your channel settings. importance 1.00 = critical override (severity 1.00 ≥ 0.9) ≥ threshold 0.5".
   - As documented, Gmail set the From to the authenticated account.
