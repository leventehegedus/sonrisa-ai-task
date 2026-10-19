# Final review: M1 "Core engine (no HTTP)", `feat/core-engine` d6fa4aa..74b1ec1

Reviewer: Claude Opus 5.5 (read-only, single reviewer, no subagents). I reviewed in three passes: (1) the spec, plan, constraints and deferred list; (2) the whole diff, src first and then tests; (3) targeted probes.

**What I ran:**
- `npx vitest run` in `server/`: 9 files, 122 passed.
- `npx tsc --noEmit`: exit 0.
- A tsx probe, `/private/tmp/claude-501/-Users-leventehegedus-sonrisa-ai-task/8c1de3d3-079f-4bed-abad-d3232cea2d47/scratchpad/probe.mts`. It uses real modules on an in-memory DB and checks:
  - (a) CoinGecko escalation within one day;
  - (b) the full chain on a fresh DB: fixture bodies → `pollSource` → `ingest` → `dispatchPending` → real email adapter writing to a temp outbox;
  - (c) what the Slack adapter puts in the request body when the feed text is hostile.

  Probe output:
  ```
  (a) coingecko -3.1% then -8% same day: inserted 1 0 deliveries 0
  (b) poll 1..4 ok (225, 50, 60, 26 inserted)
  (b) deliveries after first poll for one HU user: 111
  (b) oldest event that got a delivery: 2026-10-14T14:31:53.000Z
  (b) dispatched over 5 ticks: {"sent":111,...} outbox files 111
  (c) slack body: {"text":"*<!channel> <https://evil.example|Official notice>*\nr"}
  ```

## Strengths

- **The pipeline fits together end to end.** Probe (b) runs fixture → poll → normalize → ingest → delivery → dispatch → email outbox file with no glue code. The types are consistent along the whole chain: `NewEvent`/`EventRow`, `ScoreBreakdown` stored as JSON, and `rowToEvent` used again in dispatch.
- **Scoring matches the spec exactly.**
  - All 12 rows of §8 are tested.
  - The constants exist only in `weights.ts`, and the epsilon is applied.
  - Empty region and subregion (AQ) never count as a match. That is a nice catch beyond the spec.
- **Dedup is right at both levels.**
  - `INSERT OR IGNORE … RETURNING *` only returns new rows, so the matcher runs only for new events.
  - The `channelOk` check (owner, enabled, exists) means a delivery can never get a NULL `channel_id` or go to another user's channel. This closes the Task 1 deferred finding, and there are tests for it.
- **Failure isolation in polling (Review Focus 1) is solid.**
  - Covered cases: HTTP 500, HTML on a 200, truncated XML, network errors, unknown adapter type, bad config JSON.
  - `last_error` is capped at 500 chars, and the response body is deliberately kept out of the error.
  - No partial events: normalize runs before the transaction.
  - The `Object.hasOwn` guards on adapter and alert-level lookups block the `constructor` / `toString` prototype traps.
- **The dispatcher's error handling is careful.**
  - Permanent failures (deleted, disabled, unknown type, invalid config, corrupt data) fail at once with `attempts` 0.
  - Transient failures back off at 30 s and then 60 s, and fail at 3 attempts.
  - `markSent` sits outside the retry `try`.
  - Errors are scrubbed with the channel config.
  - The trigger-based "disk full" test is a good piece of test design.
- **Secret handling (Review Focus 2, adapter half) holds up.**
  - Masking keeps only the last 4 characters.
  - Fetch rejections are wrapped by `err.name` only, so no message text passes through.
  - There is a 10 s Slack timeout.
  - The Slack schema needs `https` plus the `hooks.slack.com/` prefix with its slash, so `hooks.slack.com.evil.com` is rejected.
  - Outbox filenames are sanitized and written with `wx`, and the path-traversal test checks this.
- **Review Focus 4 is done properly:** `toLocaleLowerCase('hu')` plus `includes`, with no RegExp.
- **URL schemes are hardened everywhere an `event.url` is created:** RSS, GDACS and manual input are all http(s) only.
- **The tests check real behaviour on real fixtures.** The fixture counts were recounted, and the tests assert meaning rather than mock calls.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**I1. The first poll of a fresh DB backfills the whole feed as alerts.**
- *Where:* `server/src/pipeline/poll.ts:88` and `server/src/pipeline/ingest.ts:17-31`.
- *What:* On first start, every item already in each feed counts as "new". Probe (b) gave **111 alerts for one HU user** at the default threshold, for events up to **5 days old** (50 telex + 60 hvg + 1 GDACS Red). The M2 seed has two HU users (Anna and Bence), so the first `npm run dev` would send about **222 alerts within ~3 ticks**. If `SEED_SLACK_WEBHOOK` is set, about 111 of them go to a real Slack channel at 50 per tick. That runs into Slack's ~1 msg/s limit and causes 429 → retry → `failed` churn.
- *Why it matters:* The spec is silent on backfill, but no reasonable user expects a flood of week-old news the moment they turn the app on. It also buries the admin "inject" demo and the delivery log the graders will look at. It is not the spec's §4 "spam" (same event twice), but the effect on the person is the same kind of thing.
- *Fix (small, M1-owned):* When a source's `last_polled_at IS NULL`, insert its events as a baseline without creating deliveries, for example `ingest(db, events, now, { deliver: false })`. A cheaper alternative is to skip events whose `occurredAt` is older than about 2 × `poll_interval_s`. Add one chain test, poll the fixture twice and assert that only items new in the second poll produce deliveries. That test also closes the full-chain gap (M2 below). Record the choice in `docs/decisions.md`.

**I2. Plan/spec defect: a market crash later in the same UTC day never alerts.**
- *Where:* `server/src/sources/coingecko.ts:724`, `externalId = coin:YYYY-MM-DD`. This follows spec §7 to the letter.
- *What:* Polling runs every 5 minutes, so the first poll that crosses 3% almost always catches the move at about 3.0–3.5%. That gives severity ~0.5 → importance ~0.42 → dropped. That event's ID uses up the coin's slot for the day. Probe (a): −3.1% and then −8% on the same day gave **1 event and 0 deliveries**. At the default threshold, market alerts only fire when the 24h change jumps past 4% between two polls. That rarely happens, so Goal 1/2's "market movements" is close to dead in practice.
- *Why it matters:* This is a spec defect, not an implementation bug. GDACS already solves the same problem with escalation IDs (§7), but markets were not given the same treatment.
- *Fix (needs a controller/spec amendment):* Use escalation bands, mirroring GDACS. For example `externalId = coin:YYYY-MM-DD:<band>` with bands at |change| ≥ 3 / 4 / 6 (the severity steps 0.5 / 0.67 / 1.0). That allows at most 3 alerts per coin per day. Add a test: −3.1 then −8 on the same day → two events, and the second one fires.

**I3. Untrusted feed text goes into Slack mrkdwn without escaping.**
- *Where:* `server/src/channels/slack.ts:227`.
- *What:* Titles and summaries come from third-party RSS and GDACS feeds, or from admin inject, and are placed into `text` as they are. Probe (c) showed that `<!channel>` and `<https://evil.example|Official notice>` reach Slack unchanged. Slack turns these into an @channel ping and a disguised link. The controller already treated phishing links through `event.url` as Important (Task 4 ruling); this is the same attack through the title.
- *Fix:* Escape `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` in title, summary and reason, as Slack's docs require. Send the URL as a plain escaped string. Add a test asserting that `<!channel>` reaches the body as `&lt;!channel&gt;`.

**I4. The `channels.type` CHECK constraint breaks the "one adapter file + one registry line" goal.**
- *Where:* `server/src/db/schema.sql:306`, `CHECK (type IN ('email','slack'))`.
- *What:* Spec Goal 4 [user] and §10 ("nothing else changes") promise that adding a channel means one adapter file plus one registry line. With the CHECK in place, a new `teams` adapter also needs a schema edit. Worse, `CREATE TABLE IF NOT EXISTS` never changes an existing DB, so on any existing `data/alerts.db` the new channel's inserts fail at runtime even after the edit.
- *Fix:* Drop the CHECK. The type is already validated against the registry: the dispatcher fails unknown types, and M2's route will check `type in registry`. Note that in the M2 plan.

### Minor (Nice to Have)

**M1. The at-least-once behaviour is undocumented, and the comment next to it is misleading.**
- *Where:* `server/src/pipeline/dispatch.ts:481`.
- *What:* The comment says a DB error here "must not be routed into retry (would duplicate the alert)". In fact the row stays `pending` with the same `next_attempt_at`, as the test at `dispatch.test.ts:1294` shows, so the **next tick sends it again**. While the failure lasts (for example a full disk), that resend happens every 10 s. The controller ruling accepted at-least-once, but asked for a `shortcut:` comment, and there is none.
- *Fix:* Replace the comment with: `// shortcut: at-least-once — if this write fails the row stays pending and the next tick re-sends; add receiver idempotency keys or a 'sending' claim state if duplicates matter`. **Fix before merge**, because the ruling made it a condition.

**M2. No test covers the full chain from a fixture body to a dispatched message.**
- *What:* `poll.test.ts` "dispatches pending deliveries after polling" calls `ingest` by hand and has no source. Each stage has good tests on its own, and probe (b) shows the chain works today. But a chain test is what would have caught I1, and it is the regression net M2 needs.
- *Fix:* Add it together with the I1 fix: one HU user, telex fixture, real email adapter writing to a temp outbox, then assert the files and `status='sent'`.

**M3. M2 readiness: `rows.ts` has no mappers for channels, deliveries or sources.**
- *Where:* `server/src/db/rows.ts`.
- *What:* M2 routes need `rowToChannel` (with `maskConfig`), `rowToDelivery` (parsing `score_breakdown`) and `rowToSource`. R-P5 forbids mapping inside route files.
- *Fix:* Add them at the start of Task 9 so mapping is not written inline in routes. Not needed for M1 itself.

**M4. M2 readiness: dispatch concurrency.**
- *Where:* `dispatchPending`.
- *What:* `dispatchPending` reads its batch up front and then awaits each send. A second concurrent caller would pick up the same `pending` rows and send them twice. Today only the scheduler calls it, behind a re-entrancy guard, which is safe.
- *Fix:* Document "only the scheduler calls `dispatchPending`". M2's retry and test routes must not call it; the plan's design already doesn't.

**M5. M2 readiness: `next_attempt_at` must be written in ISO format.**
- *Where:* `dispatch.ts:447`.
- *What:* The due check is a string comparison against `toISOString()` values. If the M2 retry route writes `datetime('now')` (`YYYY-MM-DD HH:MM:SS`), the comparison still happens to work, but only because of how the strings sort.
- *Fix:* The retry route should write `now.toISOString()`.

**M6. `startScheduler().stop()` doesn't wait for a tick that is still running.**
- *Where:* `scheduler.ts:642`.
- *What:* M2 shutdown, or tests that call `app.close()` and then `db.close()`, can hit a running tick that then logs "database is not open".
- *Fix:* Have `stop()` return a promise for the current tick.

**M7. A throwing `deps.log` crashes the process.**
- *Where:* `scheduler.ts:637-640`.
- *What:* This is the deferred Task 8 item, but the consequence is worse than "rejects the tick". `void tick()` and `setInterval(tick)` leave the rejection unhandled, and Node ≥15 exits on unhandled rejections.
- *Fix:* `tick().catch(() => {})`, or a try/catch around the log calls. Low likelihood with Fastify's logger.

**M8. GDACS rejects the whole feed over one bad item; RSS skips bad items.**
- *Where:* `gdacs.ts:762`.
- *What:* If GDACS ever ships an item with an unexpected alert level, disaster alerts stop entirely until that item leaves the feed, which can take days. `last_error` would show it, so this is visible.
- *Fix:* Optionally skip the item and count it, the same way RSS does.

**M9. `SMTP_URL` is not in the scrub set.**
- *Where:* `dispatch.ts:473`.
- *What:* Errors are scrubbed against the channel config only. Nodemailer errors don't normally echo the URL, so this is defence in depth only.
- *Fix:* Scrub against `{ ...config, smtpUrl }` as well, for example by giving the email adapter its own scrub of `opts.smtpUrl` before rethrowing.

**M10. Fetched bodies have no size cap.**
- *Where:* `poll.ts:586`.
- *What:* A hostile or misconfigured feed URL can return a very large body, and `res.text()` reads all of it. The 15 s timeout limits the damage. This is low priority for a local app.

## Deferred-minor triage

| Item | Call | Note |
|---|---|---|
| Ruling: archive the workspace to `docs/sdd-archive/<milestone>/` | Agree | |
| T1: dev script points at `src/index.ts` | Can wait | Task 10 owns `main.ts`. `npm run dev` is broken until then, which is expected in M1. |
| T1: NULL `channel_id` bypasses UNIQUE | **Resolved** | `ingest.ts` `channelOk` plus the test "nonexistent channel id … no NULL row". Close it. |
| T1: no rule-delete → NULL test; no indexes | Can wait | |
| Ruling: commit trailers name the actual model | Agree | |
| T2: misleading "AQ vs AQ is home" test name | Can wait | One-line fix; do it in passing. |
| T2: epsilon test covers only the below side | Can wait | |
| T3 Ruling: R-P9 RED via stubs | Agree | |
| T3: keyword can match across the title/summary boundary | Can wait | Joining with `'\n'` instead of `' '` fixes it at no cost, since keywords are trimmed. |
| T4 Ruling: `javascript:`/`file:` URLs → Important | Agree | Verified fixed: `httpUrl`, `protocol: /^https?$/`, with tests. |
| T4 Ruling: empty externalId → Important | Agree | Verified fixed (`rss.ts:917`), with a test. |
| T4: double-encoded HTML survives | Can wait | Summaries are plain text. If HTML email is ever added, the sanitizer shortcut covers it. |
| T4: empty `<channel/>` throws | Can wait | A quiet feed would show a false `last_error`. Cosmetic. |
| T4: missing coin vs null change inconsistency | Can wait | Worth revisiting together with I2, because a `null` change for one coin rejects all coins. |
| T4: no 23:30Z UTC-date test; no 3% boundary test | Can wait | Add the boundary test alongside the I2 fix. |
| T4: skipped id-less RSS items are silent | Can wait | |
| T5: `(r as any).id` in ingest | Can wait | Cosmetic. |
| T5: `rows.ts` untyped param lacks a `shortcut:` comment; no raw round-trip test | Can wait | Extend `rows.ts` in Task 9 (M3 above). |
| T6 Ruling: outbox mode logs one line | Agree | Verified: to + subject + file, no secrets. |
| T6 Ruling: Slack timeout → Important | Agree | Verified: `AbortSignal.timeout(10_000)`, with a test. |
| T6 Ruling: wrap fetch rejections by `err.name` | Agree | Verified, with a test. |
| T6: look-alike-host test, ENAMETOOLONG, transport per send, `String(info.message)` | Can wait | I checked look-alike hosts by reasoning: the prefix includes the trailing `/`, so they are safe. |
| T7 Ruling: `markSent` outside the try → Important | Agree | Verified. |
| T7 Ruling: corrupt data fails permanently → Important | Agree | Verified, with a test. |
| T7: non-Error throws, LIMIT 50 untested, `void user` noise, "channel disabled" for a missing row | Can wait | A missing row can't happen because of `ON DELETE SET NULL`. |
| T7 Ruling: accept at-least-once with a `shortcut:` comment | Agree with the ruling, **but fix before merge** | The comment is missing and the existing one is misleading (M1). |
| T8: throwing `deps.log` rejects the tick | Can wait | One-line `.catch`. The real effect is a process crash (M7), but the likelihood is low. |
| T8: drop-deliveries test has no assertions | Can wait | |
| T8: final UPDATE failure reports `inserted: 0` after commit | Can wait | |
| T8: malformed `last_polled_at` → never due | Can wait | Only the code writes it, always as ISO. |
| T8: `row: any` in `poll.ts` | Can wait | Use `rowToSource` in Task 9. |
| T8: `poll error:` branch untested | Can wait | |
| T8: sequential slow sources delay dispatch | Can wait | Worst case is about 5 × 15 s = 75 s of dispatch delay. Acceptable for v1. |

## Declined to judge

- **Steady-state volume of HU news alerts.** Every normal telex/hvg article reaches HU users at threshold 0.5. That is the spec's own §8 row ("HU news, normal → sent"), approved by the user.
- **Slack sends only `{ text }`, not `{ text, blocks }` (§10).** Message formatting is left to the builder (§15), and the plan specifies `{ text }`.
- **Email body leaves out the title** (it is only in the subject). Formatting is the builder's call.
- **No indexes on `deliveries`.** Fine at this scale. DDL is the builder's call.
- **Leaving GDACS Green items in the feed.** Explicitly kept by the spec (§7 "GDACS noise").
- **RSS ID falling back to the title, so two items with the same title collide.** A deliberate last resort that is reviewed and tested.
- **XML entity-expansion hardening in fast-xml-parser.** That is library behaviour; the major version is pinned by the plan.
- **HTTP-layer Review Focus items** (2 route half, 3 route half, 5). Task 9/10, M2.
- **Header-identity auth, seeding, `main.ts`.** M2.
- **TypeScript 7 choice.** Covered by R-P3, and typecheck passes.

## Assessment

**Ready to merge? With fixes.**

The engine is well built and the stages genuinely fit together. Fix the following before merging:
- **I1:** first-poll backfill. M1-owned; it would flood the first M2 run.
- **I3:** Slack escaping.
- **I4:** drop the channel-type CHECK.
- **M1:** the at-least-once `shortcut:` comment the ruling required.
- **M2:** the chain test, added with the I1 fix.

**I2** is a spec defect. It needs a controller ruling and a spec amendment before it is fixed; it is small to do in M1 once approved, and acceptable to defer to an explicit follow-up if it is logged.
