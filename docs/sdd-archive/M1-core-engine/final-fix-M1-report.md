# M1 final-review fix report

Implementer: Claude Opus 5.5. Branch `feat/core-engine`.

**Commits:**
- `09c9979` fix(server): backfill guard, coingecko escalation bands, scheduler log safety. Covers I1, I2, M7 and M2.
- `5108e3a` fix(server): escape slack mrkdwn, drop channel type CHECK, note at-least-once. Covers I3, I4 and M1.

## RED evidence (R-P9)

Before any test was written, the only code change was a stub: `ingest(..., _opts = {})`, with the option ignored. On that RED run, vitest collected every test and reported 17 failed and 122 passed out of 139:

```
FAIL test/chain.test.ts > full chain ... > first poll is a baseline; only the item new in the second poll is delivered
  AssertionError: expected 49 to be +0
FAIL test/channels.test.ts > slack > escapes &, <, > in every untrusted value (no mrkdwn injection)
  AssertionError: expected '*<!channel> <https://evil|Official no…' to be '*&lt;!channel&gt; &lt;https://evil|Of…'
FAIL test/db.test.ts > openDb > accepts any channel type (validity is the adapter registry, not the schema)
  SqliteError: CHECK constraint failed: type IN ('email', 'slack')
FAIL test/dispatch.test.ts > dispatchPending > fails permanently for a disabled channel, unknown type, or invalid config
  SqliteError: CHECK constraint failed: type IN ('email', 'slack')
FAIL test/ingest.test.ts > ingest > createDeliveries: false stores the event but creates no delivery (first-poll baseline)
  AssertionError: expected 1 to be +0
FAIL test/ingest.test.ts > ingest > an event older than 24h is stored but creates no delivery; one just inside 24h does
  AssertionError: expected 2 to be 1
FAIL test/poll.test.ts > pollSource backfill baseline > first poll (last_polled_at NULL) stores events but creates no deliveries
  AssertionError: expected 50 to be +0
FAIL test/poll.test.ts > startScheduler > a throwing log never becomes an unhandled rejection
  AssertionError: expected [ Error: log down ] to deeply equal []
FAIL test/sources.test.ts > coingecko > BTC -6 → severity 1, ETH +4 → 4/6
  AssertionError: expected { source: 'coingecko', …(10) } to match object { source: 'coingecko', …(5) }
FAIL test/sources.test.ts > coingecko escalation bands > change 3 / -3.1 / 3.99 → band :3
  AssertionError: expected 'bitcoin:2026-10-19' to be 'bitcoin:2026-10-19:3'
FAIL ... change 4 / -5.9 → band :4   AssertionError: expected 'bitcoin:2026-10-19' to be 'bitcoin:2026-10-19:4'
FAIL ... change 6 / -8 → band :6     AssertionError: expected 'bitcoin:2026-10-19' to be 'bitcoin:2026-10-19:6'
FAIL ... -3.1% then -8% the same UTC day → two events; the second alerts ...
  AssertionError: expected [] to have a length of 1 but got +0
```

The two I4 tests failed with the SQLite CHECK error itself. That error is the behaviour being removed, so the failure shows the bug directly rather than a missing module. Every other test failed on an assertion. After the fixes, all 139 tests pass.

## Per finding

**I1: first-poll backfill flood**
- *Change in `server/src/pipeline/ingest.ts`:*
  - `:6` adds `MAX_EVENT_AGE_MS = 24h`.
  - `:8` adds the signature `ingest(db, events, now, opts: { createDeliveries?: boolean } = {})`.
  - `:25` computes the cutoff.
  - `:33` adds the guard. It runs after the event is inserted and before rules are matched, so the event is still stored.
- *Change in `server/src/pipeline/poll.ts:48-49`:* passes `{ createDeliveries: row.last_polled_at !== null }`. `row` is read before `last_polled_at` is updated, so this tests the "before this poll" value.
- Manual inject has `occurredAt = now` and uses the default options, so it is unaffected.
- *Tests:*
  - `server/test/ingest.test.ts:88` (baseline option) and `:96` (24h boundary, one second on each side).
  - `server/test/poll.test.ts:128`:
    - On the first telex poll, 50 events are stored and 0 deliveries created.
    - With `last_polled_at` seeded, 50 deliveries are created.

**I2: CoinGecko escalation bands**
- *Change in `server/src/sources/coingecko.ts`:*
  - `:33` sets `band = abs >= 6 ? 6 : abs >= 4 ? 4 : 3`.
  - `:36` sets `externalId = ${coin}:${day}:${band}`.
  - The severity formula is unchanged.
- *Tests in `server/test/sources.test.ts`:*
  - The existing test now expects `bitcoin:2026-10-19:6` and `ethereum:2026-10-19:4`.
  - `:164` is a band table: 3 / -3.1 / 3.99 → `:3`, 4 / -5.9 → `:4`, 6 / -8 → `:6`. Each row also checks severity, and 2.99 gives no event.
  - `:178` is the ingest-level test with a HU user at the default threshold:
    - -3.1% gives 1 event and 0 deliveries.
    - -8% gives a new event `bitcoin:2026-10-19:6` and 1 delivery, through the critical override.
    - -7% re-polls into the same band and is deduped.

**I3: Slack mrkdwn injection**
- *Change in `server/src/channels/slack.ts`:*
  - `:9-10` adds `esc()`, which handles `&` first, then `<` and `>`.
  - `:18` escapes the title, summary, reason and url.
- *Test in `server/test/channels.test.ts:71`:*
  - The title is `<!channel> <https://evil|Official notice>`, and the summary, reason and url are hostile too.
  - It asserts the exact escaped text, and that no `<` or `>` remains.

**I4: drop the CHECK on `channels.type`**
- *Change in `server/src/db/schema.sql:12`:* the CHECK is gone, with a comment saying why. This applies to fresh DBs only; there is no migration.
- *Tests:*
  - `server/test/dispatch.test.ts:83` now uses the genuinely unknown type `'sms'` and gets `unknown channel type sms`.
  - The new `server/test/db.test.ts:32` inserts a `teams` channel.

**M1: comment about at-least-once delivery**
- *Change in `server/src/pipeline/dispatch.ts:49-50`:* the misleading comment is replaced with an accurate one and this shortcut:

  ```
  // shortcut: at-least-once — if this write fails after a successful send, the row stays pending and the next tick re-sends it, add a claim-before-send ('sending') state or receiver idempotency keys if duplicates matter
  ```

  The existing comment test at `dispatch.test.ts` already pins the behaviour, so no behaviour changed.

**M2: full-chain test**
- *New file `server/test/chain.test.ts`.* It uses one HU user, the real email adapter from `createChannelRegistry` writing to a temp outbox, and a fixed `now` of 2026-10-19T18:00Z. The telex items run from 06:42Z to 17:04Z, so none of them falls outside the 24h window. Steps:
  1. Poll 1 uses the telex fixture without its newest item. It stores 49 events and creates 0 deliveries, because it is the baseline.
  2. Poll 2 uses the full fixture, which adds 1 new event.
  3. `dispatchPending` returns `{ sent: 1 }`.
  4. The status is `sent`, there is exactly 1 outbox file, and its `subject` equals `[World Alerts] <newest telex title>`.
- This test covers I1(a) end to end as well.

**M7: a throwing `deps.log` in the scheduler**
- *Change in `server/src/pipeline/scheduler.ts:42-45`:* `safeTick = () => { tick().catch(() => {}); }` is used both for the immediate tick and for the interval.
- *Test in `server/test/poll.test.ts:232`:* a source of unknown type fails, so `log` is called, and `log` throws. A `process` `unhandledRejection` listener collects nothing. The RED run collected `Error: log down`.

## Final verification

```
$ npm test -w server
 Test Files  10 passed (10)
      Tests  139 passed (139)
$ npm run typecheck -w server
> tsc --noEmit
(exit 0)
```

## Concerns

- **CoinGecko with `minChangePct` below 3:** a 2–3% move gets band `3`, because band is "highest of 3/4/6 reached" and none was reached. This is harmless and only matters with a non-default config.
- **Unparseable `occurredAt`:** `Date.parse` gives NaN, and the guard lets the event through. Today every adapter writes an ISO timestamp.
- **M7 swallows silently:** the only way `runTick` can reject is through the log itself, so there is nowhere left to report the error.
- **Scheduler test timing:** the M7 test waits 20 ms of real time for the immediate tick. The tick never awaits network calls, because unknown-type sources fail before fetch, so 20 ms is ample. It is still a real-timer test.
- **Two `poll.test.ts` tests now run as baselines:** "dispatches pending deliveries after polling" and the GDACS polls have no users, or they ingest by hand, so their behaviour is unchanged.
- **For the controller to log:** the R-011 and R-012 entries in `docs/decisions.md` and `docs/ai-review-log.md` are yours to write; I did not edit them.
