# 003 — Log all prompts, branch per feature, skill install steps

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5)

## Prompt

```text
pls log ALL the prompts, also the previous one, where I asked for the planning. Also create a new branch for it and every new features or fixes.
Pls also add step by step how to install the ponytail and caveman if you cannot install it by your own.
```

## Outcome

- Logged prompt 002 retroactively. Rule from now on: log **every** prompt, including clarifications and answers to questions, not only "task" prompts.
- Created branch `planning/initial-plan`. From now on every feature or fix gets its own branch.
- **Course-correction:** in prompt 002 the agent said only the user could install the plugins. It then checked and found that the `claude` CLI (`2.1.218`) has `claude plugin marketplace add` / `claude plugin install` subcommands, and installed both plugins itself at user scope. Verified with `claude plugin list`.
- Wrote the step-by-step install guide anyway, for reproducibility: [`docs/setup-skills.md`](../docs/setup-skills.md).
- Backfilled the commit hash for prompt 001.

## Decisions

- D-003: A branch per feature or fix, with a naming convention.
- D-004: The agent installs the plugins itself through the CLI and documents the manual steps.

## Commit

`d0ff1bf` — docs: log prompts 002-003, add skill setup guide, adopt branch-per-feature
