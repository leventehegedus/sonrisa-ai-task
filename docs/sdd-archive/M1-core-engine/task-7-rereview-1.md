### Finding Verdicts
1. RESOLVED. markSent/out.sent++ now follow the send try/catch (catch ends in `continue`), so only adapter.send drives retry. Test uses a BEFORE UPDATE trigger on status='sent': asserts adapter called once, rejects with 'disk full', row unchanged (pending, attempts 0, last_error null, next_attempt_at unchanged). Meets the requirement.
2. RESOLVED. buildMessage(rowToEvent(getEvent.get(...)), JSON.parse(score_breakdown)) runs in its own try before send; any throw -> fail('corrupt delivery data'): status failed, attempts untouched, failed++, adapter not called. Missing event (rowToEvent on undefined) is covered by the same catch. Test with '{not json' asserts all of it. `void user; void channel;` removed (also unused destructures dropped).

### New Breakage in the Fix Diff
None. The `continue` in the catch is correct; ordering of counters unchanged.
Propagation judgement: acceptable. dispatchPending has no caller in src yet (scheduler not built), so nothing can crash today. Before the fix a DB failure in markSent was swallowed into markError (which itself would throw on a persistent DB fault, so propagation already existed for that path; markFailed/markError throw likewise). The new behaviour is not worse: row stays pending/due, at-least-once. The future scheduler tick must wrap dispatchPending in try/catch/log.

### Out-of-Scope Observations
- Task for the scheduler task: catch and log rejections from dispatchPending so a DB fault cannot become an unhandled rejection.
- A persistent markSent failure would leave a row resending every tick (inherent at-least-once; a claim-before-send state would be needed to avoid it).
- Sync better-sqlite3 UPDATEs in a mid-batch throw abort the remaining up-to-50 rows for that tick only.

### Verdict
APPROVED. Both Important findings fixed with adequate tests; no regressions found. (Tests not re-run; implementer reports 110 passing.)
