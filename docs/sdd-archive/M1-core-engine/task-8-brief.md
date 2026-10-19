### Task 8: Polling and scheduler

**Files:**
- Create: `server/src/pipeline/poll.ts`, `server/src/pipeline/scheduler.ts`
- Test: `server/test/poll.test.ts`

**Interfaces:**
- Produces: `pollSource(db: Database, sourceId: number, deps: { fetchImpl: typeof fetch; now: () => Date }): Promise<{ ok: boolean; inserted: number; error?: string }>`. It loads the source row, validates its config with the adapter's schema, fetches `adapter.url(config)` with a 15 s `AbortSignal.timeout` and a `User-Agent: world-alerts/0.1` header, treats non-2xx as an error, then calls `normalize` and `ingest`. It always updates `last_polled_at`, and sets `last_error` to the message or `null`. **It never throws.**
- Produces: `startScheduler(db, deps: { fetchImpl; registry; now; log }): { stop(): void }`. It runs one `setInterval` per tick of 10 s that:
  1. polls every enabled source whose `last_polled_at` is older than `poll_interval_s`, sequentially;
  2. calls `dispatchPending`.

  A re-entrancy guard means only one tick runs at a time.

- [ ] **Step 1: Write the failing tests** with a stub `fetchImpl` returning fixture bodies:
  - Polling GDACS inserts 225 events and sets `last_error` to null.
  - **Review Focus 1:** the stub returns status 500 → `ok:false`, `last_error` contains `500`, 0 events. The stub returns `'<html>oops'` with 200 → `ok:false`, 0 events. A stub that throws (network error) → `ok:false`.
  - After a failing source, polling a second source still works.
  - A disabled source isn't polled by one scheduler tick. Export `runTick(db, deps)` for the test, and have `startScheduler` call it.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): source polling with isolated failures and scheduler`
- [ ] **Step 6: Milestone gate M1:** `npm test -w server` is green. Dispatch the code-review subagent on `feat/core-engine` and triage its findings into `docs/ai-review-log.md`. Merge to `main`.

