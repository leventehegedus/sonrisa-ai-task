# Fix B1 report

Commit: see `git log -1` on fix/poll-baseline ("fix(server): keep poll baseline until first successful poll").

## Changes
- server/src/db/schema.sql:68 new column `sources.baseline_at TEXT` (NULL until first successful poll).
- server/src/pipeline/poll.ts: UPDATE now also sets `baseline_at = COALESCE(baseline_at, ?)` (now only when error === null); `createDeliveries: row.baseline_at !== null`. `last_polled_at` unchanged (attempt time; scheduler.ts:16 still uses it, no change needed).
- server/test/poll.test.ts: addSource gets `baselineAt`; "later poll" test seeds it; new test "a failed first poll keeps the baseline..." (500 -> success: 0 deliveries + baseline_at set -> third poll with 1 new item: 1 delivery).

## RED (column in schema, poll.ts unchanged)
AssertionError: expected 50 to be +0 // Object.is equality  (test/poll.test.ts:158, deliveryCount)

## GREEN
Test Files 10 passed (10); Tests 140 passed (140). `npm run typecheck -w server` -> `tsc --noEmit`, no errors.

## Concerns
- No migration mechanism (schema is CREATE TABLE IF NOT EXISTS): an existing dev DB file lacks `baseline_at` and needs recreating. Fine pre-release.
- Existing "later poll" test passed even before the fix; it was updated to seed baseline_at.
