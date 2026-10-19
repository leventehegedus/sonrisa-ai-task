# Task 5 report: ingest pipeline

Built: server/src/pipeline/ingest.ts (one db.transaction; INSERT OR IGNORE ... RETURNING * for events; evaluate every enabled rule for newly inserted events only; deliveries only for channels that exist, belong to the rule's user and are enabled, via a SELECT check, so no NULL channel_id; deliveriesCreated = sum of `.changes`), server/src/db/rows.ts (rowToUser, rowToRule, rowToEvent per R-P5), server/test/helpers.ts (makeDb, addUser, addChannel, addRule; all return the inserted id), server/test/ingest.test.ts (8 tests: 5 from brief + cross-user channel, nonexistent channel, disabled rule).

TDD RED (stub returning empty result), 4 failed / 4 passed:
- creates a pending scored delivery...: AssertionError: expected [] to have a length of 1 but got +0
- re-ingesting the same event...: same assertion
- two rules matching on the same channel...: same assertion
- a NP event for a HU user gives no delivery: `expect(r.inserted).toHaveLength(1)` failed (expected [] length 1)
(negative tests pass trivially against the stub.)
GREEN: full server suite 82/82 passed (6 files). `npm run typecheck -w server` clean.

Self-review: rows.ts uses `any` row params (no row types defined); event raw stored as JSON.stringify(raw ?? null). Rules and users loaded once per ingest call, not per event.
Plan/spec defects: none. Concerns: none significant.
Commit: feat(server): ingest pipeline with dedup and scored deliveries
