# Task 7 report: Dispatcher

Built server/src/pipeline/dispatch.ts (dispatchPending, MAX_ATTEMPTS=3) and server/test/dispatch.test.ts (7 tests). Commit a386134.

Behaviour: selects pending + next_attempt_at <= now ordered by next_attempt_at,id LIMIT 50 (one LEFT JOIN query on channels). Permanent failures (channel deleted/disabled, unknown type, invalid config) -> failed, attempts unchanged, counted failed. Send error -> attempts+1, scrubbed last_error, retry at 30s*2^(n-1) or failed at 3. Success -> sent, sent_at, last_error null, attempts+1. Sequential awaits, per-delivery UPDATE, errors caught per delivery. Reuses rowToEvent.

TDD RED (stub returning zeros): 6 of 7 failed on assertions, e.g.
- "expected { sent: +0, failed: +0, retried: +0 } to deeply equal { sent: 1, failed: +0, retried: +0 }"
- "expected null to be 'POST *** failed'" (scrub test)
- retry/backoff, channel deleted, permanent failures, loop-continues tests likewise.
GREEN: typecheck clean; full suite "Test Files 8 passed (8) / Tests 108 passed (108)".

Self-review: backoff asserted exactly (+30s, +60s); not-due at +29s skipped; throwing adapter test (first throws, second sent).

Plan/spec defects: none. Note: schema CHECK limits channels.type to email/slack, so the unknown-type branch is tested via a slack channel with an email-only registry. Corrupt config JSON is also treated as 'invalid channel config'.
Concerns: none.

## Fix round 1
1. markSent moved outside the send try/catch. A DB error after a successful send now propagates (dispatchPending rejects) instead of being retried. Test uses a BEFORE UPDATE trigger raising on status='sent': adapter called once, row untouched (attempts 0, last_error null).
2. Message built before the send try; corrupt score_breakdown or missing event -> failed 'corrupt delivery data', attempts unchanged, counted failed. Test with '{not json'.
3. Removed `void user; void channel;`.
Results: dispatch tests 9 passed; typecheck clean; full suite 8 files, 110 tests passed.
Concern: if markSent fails, the row stays pending and due, so a later tick could resend (inherent without a sent-before-send claim; at-least-once). The thrown error also aborts the rest of the batch.
