# 022 — Step-by-step testing guide and requirements checklist

**Date:** 2026-10-20

## Prompt

```text
pls step by step lead me the way to be able to test the implemented application, and also go through with a checklist about the original requirements of the assignment
```

## Outcome

- Wrote [`docs/testing-walkthrough.md`](../docs/testing-walkthrough.md):
  - **Part A**, a browser walkthrough: install and automated checks, a clean start, the shell, live sources, a table of five inject scenarios with the expected delivery counts and the reason for each (home, sub-region, continent, critical override, global), user history, rules and channels, access control, the optional failure/retry path, and reset.
  - **Part B**, a checklist against the PM brief and the assignment's "What to submit".
- Every UI label in the guide was taken from the code (grep of the pages/components), and the seed behaviour was checked in `seed.ts`.
- **Finding:** the repository is **not pushed**. Local `main` is 60 commits ahead of `origin/main`. It's flagged as the only hard blocker. The agent didn't push: that's an outward-facing action, so it needs the user's go-ahead.
- `docs/how-to-test.md` now points to the walkthrough.

## Commit

_pending — backfilled in the next commit_
