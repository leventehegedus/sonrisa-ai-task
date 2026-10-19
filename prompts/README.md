# Prompt History

Every prompt given to the AI agent during this project is logged here, verbatim, in order.

## Conventions

- **Every** prompt is logged, including short clarifications and answers to questions.
- One file per prompt: `NNN-short-slug.md` (zero-padded, sequential).
- Each file contains:
  - **Prompt** — the exact text I wrote (verbatim, including typos).
  - **Outcome** — a short summary of what the agent did.
  - **Decisions** — any choices made during the discussion (also mirrored in [`docs/decisions.md`](../docs/decisions.md)).
  - **Commit** — the hash of the commit that completed the prompt.
- Every prompt ends with a commit. A commit can't contain its own hash, so each
  prompt's hash is backfilled into its file as part of the *next* commit.
- Work happens on a branch per feature or fix (see D-003 in the decision log).

## Index

| # | Prompt | Commit |
|---|--------|--------|
| 001 | [Project setup: prompts & docs folders](001-setup-prompts-and-docs.md) | `c79614d` |
| 002 | [Start the planning phase](002-start-planning.md) | _pending_ |
| 003 | [Log all prompts, branch per feature, skill install](003-log-all-prompts-branching-skill-install.md) | _pending_ |
