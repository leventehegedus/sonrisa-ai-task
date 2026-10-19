### Spec Compliance
- ✅ Spec compliant. Everything the brief and the controller clarifications ask for is present:
  - `pollSource` signature, the 15 s `AbortSignal.timeout`, the UA header, `HTTP <status>` without the body, the `normalize` → `ingest(db, events, now())` order, and the "never throws" contract (poll.ts:27-67).
  - Unknown id returns `source not found` with no write (poll.ts:34).
  - Unknown adapter or invalid config writes `last_error` (poll.ts:52-56, 43-47).
  - Errors are capped at 500 chars (poll.ts:69).
  - `runTick` polls enabled, due sources one at a time, logs failures, and wraps dispatch in try/catch with `dispatch error:` (scheduler.ts:86-108).
  - `startScheduler` runs an immediate tick, then a 10 s interval with `unref()`, a guard and `stop()` (scheduler.ts:110-121).
  - Every test the brief lists is present (poll.test.ts:159-333).
- ⚠️ Cannot verify from the diff: the `npm test` / `typecheck` results are the implementer's claim only. I did not re-run the suite.

### Named-risk checks
1. **Due comparison (julianday).**
   - `now` is bound from `deps.now().toISOString()` (scheduler.ts:93). SQLite's own `'now'` clock is never used, so the "inject now" rule holds.
   - SQLite time strings accept `.SSS` plus `Z`. I checked `julianday('2026-10-19T12:00:00.123Z')`: it returned 2461333.0000014, so it parses.
   - I checked the exact-boundary precision empirically with better-sqlite3: 800k random `last_polled_at = now - interval` pairs (intervals 60/300/900/3600 s) gave 0 misses. The ~10 µs concern in the report does not show up in practice.
   - Residual edge: a malformed `last_polled_at` makes `julianday` return NULL, so that source is silently never due again. Only `toISOString()` writes the column, so this is Minor.
2. **Unhandled rejection.**
   - `tick` resets `running` in `finally` (scheduler.ts:115).
   - `runTick` puts `deps.now()`, the SELECT, every poll and dispatch inside try blocks, and `pollSource` can't throw. An ordinary fault can't reject.
   - The only remaining path is a `deps.log` that throws inside a `catch` (scheduler.ts:100, 105). That would reject `tick`, and since `setInterval`/`void tick()` don't handle the rejection, it becomes an unhandled rejection. This is Minor, because log is console-backed.
3. **`normalize` succeeds, `ingest` throws.**
   - The error is caught at poll.ts:40-41. `last_polled_at` and `last_error` are still written (poll.ts:44), and the result is `ok:false, inserted:0`.
   - `ingest` is one `db.transaction` (ingest.ts:19), so it rolls back.
   - There is no state flag in pollSource to leave inconsistent.
   - This path is in fact exercised: the `DROP TABLE deliveries` test makes `ingest`'s `db.prepare(INSERT INTO deliveries…)` throw (ingest.ts:12). But the test makes no assertion about it (see Minor).
4. **Re-entrancy test.** It genuinely tests overlap.
   - The immediate tick is parked on an unresolved `gate` inside `fetchImpl` when the +10 s interval fires.
   - The source is still due at that point, because `last_polled_at` is NULL. Without the guard, the second tick would call fetch, so `calls` would be 2.
   - The reported mutation check (guard removed → length 2) matches this reasoning.

### Strengths
- `pollSource` has a clean structure: one try around fetch+ingest and a separate try for the bookkeeping write. Every branch where the row exists writes `last_polled_at`/`last_error`.
- `Object.hasOwn` on the adapter lookup prevents prototype-key resolution (`toString`).
- The HTTP error never reads the body, and the test asserts `SECRET BODY` is absent (poll.test.ts:183).
- The tests cover the brief's cases plus some extras: truncated XML, dedupe on a second poll, the 500-char cap, corrupt config JSON, and the exact-interval due boundary (299 s vs 300 s).
- The fake-timer test with a gated fetch is a convincing guard test. RED evidence shows assertion failures, as R-P9 requires.
- Small, focused files with no speculative options.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **A throwing `deps.log` can reject `tick` and cause an unhandled rejection** (scheduler.ts:97, 100, 105, 115).
   - Scenario: if `log` throws inside the catch blocks, the rejection escapes `tick`, which is called via `void tick()` and `setInterval`.
   - Fix: add `.catch(() => {})` around the call in `tick`, e.g. `try { await runTick(...) } catch {} finally {...}`.
   - Low likelihood with a console logger.
2. **The ingest-throws path is exercised but not asserted** (poll.test.ts:297-304).
   - With `deliveries` dropped, the GDACS poll fails inside `ingest`.
   - Suggest adding asserts that the source's `last_error` matches `/deliveries/`, `eventCount(db) === 0` (rollback), and `log` was also called with `poll failed`. This would pin down named risk 3 explicitly.
3. **The UPDATE-failure branch misreports work done** (poll.ts:43-48).
   - If fetch+ingest succeeded but the bookkeeping UPDATE throws, the function returns `inserted: 0`, although events were committed, and `last_error` isn't stored.
   - This is acceptable for a DB fault, but worth a one-line comment or returning the real `inserted`.
4. **A malformed `last_polled_at` makes the source never due** (scheduler.ts:91). `julianday` returns NULL for it and the `<=` comparison yields NULL.
   - Only `toISOString()` writes the column today, so this is theoretical.
   - Comparing ISO strings directly (`last_polled_at <= ?` with a JS-computed cutoff) would be exact and simpler.
5. **`row: any`** (poll.ts:28, 51): a small typed `{ type: string; config: string }` would cost nothing. Polish only.
6. **The `poll error:` branch has no test** (scheduler.ts:99-101): that is the failure of the source SELECT itself. Coverage polish.

### Assessment
**Task quality:** Approved
**Reasoning:** The code meets every requirement and clarification. All four named risks check out: `now` is injected, the julianday parsing and boundary are correct, the guard is reset in `finally` and genuinely tested with overlapping ticks, and an ingest fault records `last_error` with a rollback. The remaining items are robustness and test-assertion polish.
