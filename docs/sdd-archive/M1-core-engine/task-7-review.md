### Spec Compliance
- ✅ Spec compliant. Checked against the brief and the controller clarifications:
  - Selection: `status='pending' AND next_attempt_at <= ?`, `ORDER BY next_attempt_at, id LIMIT 50` (dispatch.ts:29-33).
  - Permanent failures (dispatch.ts:42-48): channel_id NULL, disabled, no adapter and invalid config each give the exact reason string, leave attempts unchanged, and count as failed.
  - Send error (dispatch.ts:55-62): attempts+1, scrubbed `last_error`, failed at >=3, otherwise `now + 30s*2^(attempts-1)`, counted as retried. The test asserts exactly 30s then 60s.
  - Success (dispatch.ts:36, 53): sent, `sent_at = now`, `last_error` NULL, attempts+1.
  - Sends are sequential, each update is its own statement, and there is no transaction around the network calls. A throwing adapter does not abort the loop (test at dispatch.test.ts:172).
  - `MAX_ATTEMPTS = 3` is exported.
- ⚠️ Cannot verify from diff: the real behaviour of `scrubSecrets` and the real Slack/email `configSchema`. They come from Task 6 and are not in the diff. The scrub test uses a fake adapter with a `.loose()` schema.

Named risks:
1. **Stored data, corrupt breakdown:** the message is built from the stored event row (`rowToEvent(getEvent.get(d.event_id))`) and the stored `score_breakdown` (dispatch.ts:52). Nothing is re-scored. A corrupt `score_breakdown` makes `JSON.parse` throw inside the `try`. That is caught, so the loop does not crash. The delivery is treated as a transient send error, though: it is retried at +30s and +60s, then marked failed with the SyntaxError text. This is functionally safe but misclassified (see Minor). It is also untested. A missing event row behaves the same way, since `rowToEvent(undefined)` throws.
2. **Non-Error throws:** `String(err?.message ?? err)` (dispatch.ts:57) gives `'x'` for `throw 'x'`, `'undefined'` for `throw undefined`, `'null'` for `throw null`, and `'[object Object]'` for a plain object. Nothing crashes and something is recorded. It is untested, though (see Minor).
3. **Scrubbing:** the scrub runs on `parsed.data`, the config parsed from the DB row (dispatch.ts:49, 57), so the real webhook URL is the one scrubbed. An invalid config is never sent, and the fixed string `'invalid channel config'` is stored, so the config is not echoed into `last_error`. Corrupt config JSON takes the same path (dispatch.ts:47). One caveat: if a schema ever strips a secret field, scrubbing would miss it. Zod 4 objects strip unknown keys by default, so this relies on each adapter's schema keeping its secret field. That is true for Slack's `webhookUrl`, but I could not verify it from this diff.

### Strengths
- Small and readable. One LEFT JOIN query avoids N+1 lookups, and statements are prepared once outside the loop.
- Permanent and transient failures are cleanly separated, and permanent ones do not burn attempts.
- Backoff, the not-yet-due case (+29s skipped), and the exact attempt/next_attempt_at values are asserted. Scrubbing is tested end to end through the DB.
- The unknown-type branch is tested despite the schema CHECK on `channels.type`, by registering a slack channel against an email-only registry.
- The report includes RED evidence with real assertion failures (R-P9).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- dispatch.ts:52-53: `markSent.run` sits inside the same `try` as `send`. If the DB write throws after a successful send, the catch records a send error, bumps attempts and schedules a retry, which would send the alert twice. This is very unlikely with SQLite, but moving `markSent` after the `try/catch` (or into a separate `try`) is cheap and correct.
- dispatch.ts:52: parsing `score_breakdown` and loading the event inside the send `try` means corrupt or missing stored data is retried twice before failing. It is deterministic, so it should fail immediately like the other permanent cases (for example 'invalid stored data'). Building the message before the `try` would also do it. There is no test for it.
- dispatch.ts:57: no test for non-Error throws (`throw 'x'`, `throw undefined`). The behaviour is fine, but unpinned.
- dispatch.ts:43: if a `channel_id` points at a row that does not exist (FK off), the LEFT JOIN gives `c_enabled` NULL and the delivery fails as 'channel disabled', which is misleading. FKs are presumably enforced, so this is theoretical.
- The `LIMIT 50` batch cap is untested.
- dispatch.test.ts:180: `void user; void channel;` is noise. Drop the unused destructuring instead.

### Assessment
**Task quality:** Approved
**Reasoning:** All controller-specified behaviours are implemented exactly and covered by meaningful tests. The three named risks are handled without crashes, and the only gaps are minor error-classification and test-coverage polish.
