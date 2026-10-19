# 019 — What can I test now, and what should the web UI show?

**Date:** 2026-10-19

## Prompt

```text
at this point of the what can I test? what shall I see in the web UI?
```

## Outcome

- The agent read `web/src/App.tsx`, then described the only screen there is (the connection card: its three states and Retry), how to test each state, and what the browser can't show yet (everything else is still API-only via curl; see `docs/how-to-test.md`).
- No code changes.

## Commit

_pending — backfilled in the next commit_
