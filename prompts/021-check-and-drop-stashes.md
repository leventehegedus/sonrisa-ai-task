# 021 — Check the two stashes; implement if needed, otherwise drop

**Date:** 2026-10-20

## Prompt

```text
pls check the two stashes, and if it is needed to implement please do so, if not drop them
[Request interrupted by user]
sorry, I interrupted, try again
```

## Outcome

- Compared both stashes with `main`:
  - **Task 9 partial:** its `rowToChannel` and `rowToDeliveryWithEvent` mappers already exist on `main` in a more complete form, plus `rowToSource`. Its 15 API tests are covered by the 20 tests on `main`. Its `export const configSchema` change in slack.ts isn't needed.
  - **Task 11 partial:** every shadcn component in it already exists on `main`; its scaffold, store, session and types were rebuilt and reviewed in Tasks 11a–13.
- Nothing needed implementing, so both stashes were dropped. Both remain preserved as patches in `docs/sdd-archive/M2-api/` and `docs/sdd-archive/M3-web/`.

## Commit

_pending — backfilled in the next commit_
