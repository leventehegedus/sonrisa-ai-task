# Prompt History

Every prompt given to the AI agent during this project is logged here, verbatim, in order.

## Conventions

- One file per prompt: `NNN-short-slug.md` (zero-padded, sequential).
- Each file contains:
  - **Prompt** — the exact text I wrote (verbatim, including typos).
  - **Outcome** — a short summary of what the agent did.
  - **Decisions** — any choices made during the discussion (also mirrored in [`docs/decisions.md`](../docs/decisions.md)).
  - **Commit** — the hash of the commit that completed the prompt.
- Every prompt ends with a commit. A commit can't contain its own hash, so each
  prompt's hash is backfilled into its file as part of the *next* prompt's commit.

## Index

| # | Prompt | Commit |
|---|--------|--------|
| 001 | [Project setup: prompts & docs folders](001-setup-prompts-and-docs.md) | _pending (backfilled next commit)_ |
