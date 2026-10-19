# 014 — Finish Task 11 or wait; how to test the current state

**Date:** 2026-10-19

## Prompt

```text
pls now finish task 11, explain me what and how can I test and check the current status of the app, also I'll run out of session limit soon, so if you feel that you cannot finish task 11, then wait with it
```

## Outcome

- Preserved the interrupted Task 11 partial work (patch in `docs/sdd-archive/M3-web/` plus `git stash`) and reset to a clean tree; 214/214 tests pass.
- **Ran every command for the guide against a live server** (temp DB, live feeds) before writing it:
  - all 5 sources polled with no error
  - an HU inject created 2 deliveries, and Bence's was `sent`
  - Priya (NP) got none
  - a non-admin got 403
  - outbox files were written
- Wrote [`docs/how-to-test.md`](../docs/how-to-test.md): the automated tests and what each proves, running the server, a curl walkthrough, rules and channels, optional real Slack and SMTP, and what can't be tested yet.
- **Decision: Task 11 was not started this session** (D-022). The user is near the session limit, and a full Task 11 cycle (implementer, then reviewer, possibly a fix round) wouldn't reliably finish. A third half-finished, interrupted subagent would be worse than a clean stop. The resume instructions are in [`docs/sdd-archive/M3-web/task-11-dispatch.md`](../docs/sdd-archive/M3-web/task-11-dispatch.md).

## Decisions

- D-022: Pause before Task 11; resume from the saved dispatch notes.

## Commit

`c9e877d` — docs: how-to-test guide (verified live), pause before Task 11, log prompts 013-014, D-022
