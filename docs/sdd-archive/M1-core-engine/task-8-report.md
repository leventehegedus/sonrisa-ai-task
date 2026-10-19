# Task 8 report: Polling and scheduler

**Status:** DONE. Commit `74b1ec1 feat(server): source polling with isolated failures and scheduler` on `feat/core-engine`. I did not run the milestone gate (Step 6); the controller owns it.

## What I built
- `server/src/pipeline/poll.ts`: `pollSource(db, sourceId, { fetchImpl, now })`. It never throws.
  - **Unknown id:** returns `{ ok:false, inserted:0, error:'source not found' }` and writes nothing to the DB.
  - **Unknown adapter type:** fails with `unknown source type <t>`. The lookup uses `Object.hasOwn`, so a type like `toString` can't resolve to a prototype member.
  - **Bad config:** a JSON parse failure or a failed `safeParse` both produce `invalid config`.
  - **Fetch:** calls `fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'world-alerts/0.1' } })`. A non-2xx status gives `HTTP <status>`, and the response body is never read into the error.
  - **Success path:** `res.text()`, then `normalize`, then `ingest(db, events, now())`. `inserted` is `result.inserted.length`.
  - **Bookkeeping:** every branch where the row exists writes `last_polled_at = now ISO` and `last_error`, which is either the message capped at 500 chars or `null`.
- `server/src/pipeline/scheduler.ts`:
  - `SchedulerDeps` is `{ fetchImpl, registry, now, log }`.
  - `runTick(db, deps)` selects enabled sources that are due: `last_polled_at IS NULL` or `julianday(last_polled_at) <= julianday(now) - poll_interval_s/86400`, ordered by id.
    - It polls them one after another and logs `poll failed: source <id> (<name>): <error>` for each failure.
    - It then calls `dispatchPending` inside try/catch and logs `dispatch error: <msg>` if that fails. The source select is guarded the same way, logging `poll error: …`. runTick never rejects.
    - It returns `{ polled, dispatch? }`.
  - `startScheduler(db, deps)` runs one tick immediately, then `setInterval(tick, 10_000)` with `unref()`. A `running` flag skips a tick while the previous one is still in flight. It returns `{ stop }`, which calls clearInterval.

## Tests (`server/test/poll.test.ts`, 12 tests)
- **pollSource, GDACS fixture:** inserts 225 events, clears an old `last_error`, sets `last_polled_at`, and passes the UA header and an AbortSignal. A second poll is deduped and returns `inserted: 0`.
- **pollSource, HTTP 500:** `ok:false`. `error` and `last_error` contain `500` but not the body text. 0 events.
- **pollSource, garbage body:** `'<html>oops'` with status 200 gives `ok:false`, sets `last_error` and inserts 0 events. GDACS XML truncated to half its length gives the same result.
- **pollSource, network error:** a fetch that throws gives `{ ok:false, inserted:0, error:'fetch failed' }`. A 2000-char error message is stored as 500 chars.
- **pollSource, unknown id:** returns `source not found` and fetch is never called.
- **pollSource, bad type or config:** an unknown type, an invalid rss config and corrupt config JSON each give `ok:false` with `last_error` written, and fetch is never called.
- **runTick, isolation:** a failing rss source (500) followed by GDACS gives `polled: 2`. The broken source's `last_error` contains 500, the good one's is null, there are 225 events, and the failure is logged once with the source name.
- **runTick, which sources run:** of a disabled source, one polled 299 s ago and one polled 300 s ago (interval 300 s), only the last is polled.
- **runTick, dispatch:** a pending delivery is sent and `dispatch` returns `{sent:1, failed:0, retried:0}`.
- **runTick, dispatch fault:** with the `deliveries` table dropped, runTick still resolves, `dispatch` is undefined, and `log` is called with `/^dispatch error: /`.
- **startScheduler (fake timers):**
  - The immediate tick blocks in a gated fetch, and the tick at +10 s is skipped: fetch is called once.
  - After the gate is released, there are 225 events.
  - After +300 s, fetch has been called twice.
  - After `stop()` and another +600 s, fetch has still been called only twice.
  - **Mutation check:** with the `if (running) return` line commented out, this test fails with `expected [ { …(2) }, { …(2) } ] to have a length of 1 but got 2`. I then restored the line.

## TDD evidence
**RED:** the stubs had the exported signatures and returned wrong values (`{ ok:false, inserted:-1 }`, `{ polled:-1 }`, and a `stop()` that does nothing). Result: `Tests  12 failed (12)`, all of them assertion failures:
- `polls GDACS…`: `AssertionError: expected { ok: false, inserted: -1 } to deeply equal { ok: true, inserted: 225 }`
- `HTTP 500 → ok:false…`: `AssertionError: expected { ok: false, inserted: -1 } to match object { ok: false, inserted: +0 }`
- `'<html>oops' with 200…`, `truncated GDACS XML…`, `unknown adapter type / invalid config…`: same match-object failure.
- `fetch throws (network error)…`, `unknown source id…`: `AssertionError: expected { ok: false, inserted: -1 } to deeply equal { ok: false, inserted: +0, …(1) }`
- `a failing source does not stop the next one…`: `AssertionError: expected -1 to be 2 // Object.is equality`
- `polls only enabled sources that are due`: `AssertionError: expected -1 to be 1 // Object.is equality`
- `dispatches pending deliveries after polling`: `AssertionError: expected undefined to deeply equal { sent: 1, failed: +0, retried: +0 }`
- `a dispatch fault is logged…`: `AssertionError: expected "vi.fn()" to be called with arguments: [ StringMatching /^dispatch error: / ]`
- `ticks immediately and every 10s…`: `AssertionError: expected [] to have a length of 1 but got +0`

My first stub threw `not implemented`. I replaced it with wrong-value stubs so that RED shows real assertion failures, as R-P9 requires.

**GREEN:** `Tests  12 passed (12)`.

## Verification
- `npm run typecheck -w server`: `> tsc --noEmit` printed no errors.
- `npm test -w server`: `Test Files  9 passed (9)` / `Tests  122 passed (122)`.

## Files changed
- `server/src/pipeline/poll.ts` (new)
- `server/src/pipeline/scheduler.ts` (new)
- `server/test/poll.test.ts` (new)

## Self-review
- Nothing can be partially inserted: normalize throws before ingest, and ingest is a single transaction.
- Errors are capped at 500 chars, and the HTTP error never includes the body. Messages from normalize may quote a short parser message, and the cap bounds those too.
- If the `UPDATE` of `last_polled_at`/`last_error` itself fails (a DB fault), pollSource still returns `ok:false` with that error instead of throwing. The same holds for a fault in the initial SELECT.
- The scheduler passes `deps` straight through to pollSource. pollSource only reads `fetchImpl` and `now`, so this is structurally typed and fine.
- `now()` is called separately for normalize, ingest and the bookkeeping write. With a real clock these differ by milliseconds, which doesn't matter.

## Plan/spec defects
None blocking. The brief's wording "`setInterval` per tick of 10 s" is ambiguous; I implemented one interval at 10 s, as the controller clarified.

## Concerns
- **Due check:** it uses `julianday` floats, so in theory the exact-boundary comparison could be off by about 10 µs. The test at exactly `poll_interval_s` passes, and this is irrelevant in practice.
- **`invalid config` message:** it doesn't include the zod issues. That keeps it short and bounded; the admin UI (a later task) may want more detail.
- **Long ticks:** polling runs one source at a time, so many slow sources (up to 15 s each) can delay dispatch inside a tick. The guard prevents overlap, and this is acceptable for M1.
