### Fix B1: a failed first poll must not lose the baseline

**Branch:** `fix/poll-baseline` (already checked out, based on main `af9995a`)

**Problem (from the M1 re-review, `final-fix-M1-rereview.md`):** `server/src/pipeline/poll.ts` writes `last_polled_at` on failure as well as on success. The baseline guard is `createDeliveries: row.last_polled_at !== null`. So when the first poll fails (HTTP 5xx, timeout, offline start), the first *successful* poll creates deliveries for the whole feed, limited only by the 24 h guard. That's about 50 telex alerts per Hungarian user.

**Ruling (binding):** add a column `sources.baseline_at TEXT` (NULL until the first **successful** poll). Base `createDeliveries` on `baseline_at !== null`, and set `baseline_at = now` only when a poll succeeds. `last_polled_at` keeps its current meaning (the last attempt, used for "is it due" scheduling), so a failing source isn't hammered every tick.

**Tests (server/test/poll.test.ts):**
- First poll fails (stub returns 500), then the second poll succeeds with the gdacs fixture → 0 deliveries created, and `baseline_at` is set after the second poll.
- A third poll with a new item → that item creates deliveries (reuse the existing pattern from chain.test or poll.test).
- The existing baseline tests still pass.

**Constraints:** global-constraints.md (R-P7 trailer naming your model, R-P9 failing-test evidence = assertion failures, R-P8). Run `npm test -w server` and `npm run typecheck -w server` at the end and quote the output. Commit `fix(server): keep poll baseline until first successful poll`.
