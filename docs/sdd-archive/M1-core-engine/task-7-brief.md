### Task 7: Dispatcher (outbox → channels, retries)

**Files:**
- Create: `server/src/pipeline/dispatch.ts`
- Test: `server/test/dispatch.test.ts`

**Interfaces:**
- Consumes: `buildMessage`, `scrubSecrets`, the registry from Task 6.
- Produces: `dispatchPending(db: Database, registry: Record<string, ChannelAdapter<any>>, now: Date): Promise<{ sent: number; failed: number; retried: number }>`. It picks deliveries with `status='pending' AND next_attempt_at <= now`, up to a limit of 50.
  - `channel_id IS NULL` (channel deleted) → `failed`, with `last_error 'channel deleted'`.
  - Success → `sent`, `sent_at = now`.
  - Error → `attempts += 1`, and `last_error` = the scrubbed message. If `attempts >= 3` → `failed`; otherwise `next_attempt_at = now + 30s × 2^(attempts-1)`.
- Produces: `MAX_ATTEMPTS = 3`.

- [ ] **Step 1: Write the failing tests** with a fake adapter registered under `'email'`:
  - success → `sent`.
  - Always throwing: after 3 calls (advancing `now` past `next_attempt_at` each time) → `failed`, `attempts 3`.
  - A delivery whose `next_attempt_at` is in the future is skipped.
  - **Review Focus 3:** create a pending delivery, delete its channel row, then dispatch → `failed` with `'channel deleted'`.
  - An error message containing the webhook URL is stored scrubbed.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): outbox dispatcher with retry and backoff`

