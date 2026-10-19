# 018 — Cheaper models for subagents; rethink the agent method

**Date:** 2026-10-19

## Prompt

```text
from now on pls rethink about the subagent and agent working method also, I want to communicate opus 5.5, but for tasks, subtask and subagent tasks, pls use cheaper models, I try to avoud rate limits
```

## Outcome

- New model policy (D-024), written into [`CLAUDE.md`](../CLAUDE.md) ("Model policy for agents") and saved to agent memory:
  - The main session stays on Opus.
  - Implementers use sonnet, or haiku for mechanical work.
  - Task reviewers use sonnet; scoped re-reviews use haiku.
  - Whole-branch reviews use sonnet with focused named risks.
  - Exploration uses haiku.
  - The model is always set explicitly.
- Changes to the working method that reduce call count: batch small fixes into one dispatch, pass artifacts as files, one review per task, short controller turns.
- **Trade-off stated to the user:** until now the whole-branch reviews ran on Opus/Fable, and they found the most serious issues (R-011..R-014, R-018). Moving them to sonnet is a real quality risk. It's mitigated with tighter named-risk prompts.

## Decisions

- D-024: Subagent model policy.

## Commit

_pending — backfilled in the next commit_
