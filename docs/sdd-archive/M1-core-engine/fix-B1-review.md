### Spec Compliance
- ✅ Spec compliant
- ⚠️ Cannot verify from diff: the reported test/typecheck output (140 passed, tsc clean) was not re-run. RED evidence is an assertion failure (expected 50 to be 0), which satisfies R-P9.

### Strengths
- Minimal, correct change. Schema column, one UPDATE and one guard swap (poll.ts:26, :50).
- COALESCE(baseline_at, ?) never overwrites the baseline. It is written only when error === null.
- The new test covers the full ruling sequence: fail, succeed (0 deliveries, baseline_at set), then a new item creates 1 delivery. It also asserts last_polled_at is still stamped on failure and baseline_at stays null.

### Named risks
1. Reader/writer consistency: OK. grep of server/src finds `last_polled_at` only in poll.ts:26 (write), scheduler.ts:16 (due check) and schema.sql:67. `baseline_at` appears only in poll.ts:26 (write), poll.ts:50 (read) and schema.sql:68. Scheduling is untouched, so a failing source is not re-polled every tick. Baseline is set only on success.
2. Modified "later poll" test: intent preserved. It seeds baselineAt and still asserts 50 inserted and 50 deliveries. The only change is the seed, which is needed because the guard moved columns. It is not weakened. Keeping last_polled_at in the seed is harmless.
3. Fetch OK but normalize throws: baseline_at is NOT set. normalize throws inside fetchAndIngest, so `error` is non-null, `error === null ? ... : null` binds NULL, and COALESCE(NULL, NULL) stays NULL. The same holds for a non-OK HTTP status and for an ingest throw. Correct by code reading. No test asserts this garbage-body case directly (see Minor).

### Issues
#### Critical (Must Fix)
None.
#### Important (Should Fix)
None.
#### Minor (Nice to Have)
- server/test/poll.test.ts:~104: the existing garbage-body test checks last_polled_at only. Adding `baseline_at: null` to that assertion would pin risk 3 cheaply.
- poll.ts:26-27: `deps.now()` is called twice, so the two timestamps could differ by a tick with a real clock. Harmless, but one `const ts` would be tidier.
- Existing dev DBs (and any source already polled before this fix) have no `baseline_at` column. `CREATE TABLE IF NOT EXISTS` will not add it, so the prepared statements will throw. The implementer flagged this. It is acceptable pre-release, but a one-line `// shortcut:` note near the column or in the log would follow R-P8.

### Assessment
**Task quality:** Approved
**Reasoning:** The fix matches the binding ruling exactly, scheduling semantics are unchanged, and the tests exercise the real failure sequence without weakening the existing test. Only minor polish remains.
