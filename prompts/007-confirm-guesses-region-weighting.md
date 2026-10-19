# 007 — Confirm guesses + region weighting

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5) + superpowers:brainstorming

## Prompt

```text
sure, I did not mention them in the previous prompt.

 - 1. okay
 - 2. okay
 - 3. the region should have priority, so if I live in hungary, hungarian news should be more important than a news from nepal, so we have to add weight for the news and push them or not based on it.
 - 4. okay
  - 5. okay
```

## Outcome

- Confirmed: the normalized event shape (1), free feeds plus an inject button (2), plug-in channels (4) and the admin scope (5).
- Changed (3): detection stays rule-based, but importance is now a **weighted score**. Proximity to the user's home region raises it; distance lowers it.
- The agent played back a scoring model (severity × proximity tier compared with a threshold) and asked whether distance should *dampen* far-away events or *filter them out*.

## Decisions

- D-007: Region-weighted importance score (the details depend on the answer to the open question).

## Commit

`2fce833` — docs: log prompt 007, record D-007 region-weighted importance
