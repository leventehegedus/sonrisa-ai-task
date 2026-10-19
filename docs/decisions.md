# Decision Log

Every non-trivial decision made during the project: what was chosen, what was rejected, and why.

| ID | Date | Decision | Alternatives considered | Rationale | Prompt |
|----|------|----------|-------------------------|-----------|--------|
| D-001 | 2026-10-19 | One markdown file per prompt in `prompts/`, with the prompt verbatim, outcome, decisions, and commit hash. The hash is backfilled during the next prompt's commit. | (a) Amend the commit to include its hash — impossible, amending changes the hash. (b) A separate "record hash" commit after every prompt — doubles commit noise. | Keeps one meaningful commit per prompt while still linking every prompt to its commit. | [001](../prompts/001-setup-prompts-and-docs.md) |
