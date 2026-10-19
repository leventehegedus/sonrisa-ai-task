# M1 final-review fix wave: re-review

Fix base 8304a4e, head 5108e3a. I read the diff in full and checked `poll.ts`, `manual.ts`, the adapters' `occurredAt` handling, the scheduler's due query and spec §7. I ran `npx vitest run` once: 10 files, 139 tests, all passing. The working tree is clean apart from this file.

### Finding Verdicts

| ID | Verdict | Evidence |
|---|---|---|
| I1 first-poll backfill | **Addressed, as the ruling defines it** (one gap remains, see Breakage B1) | `poll.ts:49` passes `createDeliveries: row.last_polled_at !== null`. `row` is read before the UPDATE, so the second poll sees a non-NULL value and creates deliveries; `poll.test.ts` and `chain.test.ts` both cover this. `ingest.ts:33` skips delivery creation after the INSERT, so the event is still stored, when the option is false or `occurredAt < now - 24h`. The boundary test checks ±1 s. Manual inject uses `occurredAt = now` (`manual.ts:27`) and the default option, so it always passes the guard. No inject route calls `ingest` yet (that is M2); because the default is "create", the future route is safe. |
| I2 market bands | **Addressed** | `coingecko.ts`: `band = abs>=6?6:abs>=4?4:3`, and `externalId = coin:day:band`, which matches spec §7 l.116 exactly. The band table test, the "2.99 gives no event" test and the ingest-level escalation test (-3.1 gives 0 deliveries, -8 gives 1 delivery, -7 is deduped) all pass. |
| I3 Slack mrkdwn | **Addressed** | `esc()` replaces `&` first, then `<` and `>`. It is applied once to title, summary, reason and url, so nothing is double-escaped. The test uses the exact payload `<!channel> <https://evil|Official notice>`, asserts the exact output and asserts that no `<` or `>` is left. Escaping `&` to `&amp;` in a bare URL is what Slack's text-escaping rules require, and Slack decodes it before auto-linking, so links still resolve. |
| I4 CHECK removed | **Addressed** | `schema.sql:12` no longer has the CHECK. The dispatcher test uses `'sms'` and gets `unknown channel type sms`, and `db.test.ts` inserts a `teams` channel. This only affects fresh DBs, which is fine because M1 creates no persisted DB. |
| M1 shortcut comment | **Addressed** | `dispatch.ts:49-50` now says correctly that a failed status write is not counted as a failed send. The `// shortcut:` line documents the at-least-once re-send and names the fix (a claim-before-send `sending` state or idempotency keys). |
| M2 chain test | **Addressed** | `chain.test.ts` runs the RSS fixture through `pollSource` twice (baseline, then one new item), then `ingest`, then `dispatchPending` with the real email adapter from `createChannelRegistry`. It then reads the real outbox file and asserts its subject. `now` is fixed (2026-10-19T18:00Z) and passed through every stage, so the test does not depend on wall-clock time. The temp dir is cleaned up in `afterEach`. |
| M7 throwing log | **Addressed** | `scheduler.ts`: `safeTick = () => { tick().catch(() => {}) }` handles both the immediate tick and the interval tick. The test makes `log` throw through an unknown source type and watches `unhandledRejection`. The RED run captured `Error: log down` there, so the test does exercise the path. |

### New Breakage in the Fix Diff

- **B1 (Important, small): if a source's first poll fails, the baseline is lost.** `pollSource` writes `last_polled_at` on failure as well as success (`poll.ts:26`). So if the first fetch hits HTTP 5xx, a network error or a timeout (for example, the server starts while offline), the first *successful* poll sees a non-NULL `last_polled_at` and creates deliveries for every item in the feed. Only the 24h guard limits it, and a telex feed holds about 50 items in its last 24h, so that is still about 50 alerts per HU user: the I1 flood again, minus items older than 24h. This meets the literal ruling and spec §7 (`last_polled_at IS NULL`) but not what they were for. Two possible fixes:
  - Base the flag on whether the source has ever ingested successfully. Simplest: on failure, leave `last_polled_at` NULL when it was NULL. The source then stays due and is retried every tick until the first success, which is acceptable.
  - Add a nullable `baseline_at` column that is written only on success.

  Either needs a test: first poll fails, second poll succeeds, expect 0 deliveries.
- **Other checks, no issue found:**
  - The second poll does not misfire. The guard reads the row from before the update, and both tests confirm it.
  - The 24h guard cannot drop inject events, because they use `occurredAt = now`.
  - Events dated in the future (as in `poll.test` at t0 = 12:00Z, which has items up to 17:04Z) pass the guard.
  - Escaping keeps the `*…*` bold wrapper and introduces no double escaping.
  - The M7 test runs on real timers for 20 ms, but the earlier fake-timer test restores real timers, and the tick does no network I/O, so the test is stable.

### Out-of-Scope Observations

- A `NaN` from `Date.parse` slips past the 24h guard. Today this can't happen, because `isoDate()` in RSS and GDACS falls back to `now`. Worth a `Number.isFinite` check if another adapter is added.
- When `minChangePct` is below 3, a 2–3% move is labelled band `3`. That only matters with a non-default config, and the implementer already flagged it.
- Bands ignore direction, so a +3.2% move and a -3.4% move on the same day dedupe to one event. That is acceptable and consistent with "highest band reached".
- A `*` inside a title can break Slack bold. This is cosmetic.
- The `R-011` and `R-012` entries in `docs/decisions.md` and `docs/ai-review-log.md` are still for the controller to write, as the fix report notes.

### Verdict (Ready to merge? Yes/No)

**Yes.** Every finding in this wave (I1, I2, I3, I4, M1, M2, M7) is addressed as the controller ruled, tests pass (139 of 139), and there are no regressions. One caveat: B1 leaves the backfill flood possible when a source's first poll fails. It is a small, contained fix. I recommend landing it before the first M2 run, or logging it as an explicit follow-up if the controller accepts the literal `IS NULL` ruling.
