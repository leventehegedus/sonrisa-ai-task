# Decision Log

Every non-trivial decision made during the project: what was chosen, what was rejected, and why.

| ID | Date | Decision | Alternatives considered | Rationale | Prompt |
|----|------|----------|-------------------------|-----------|--------|
| D-001 | 2026-10-19 | One markdown file per prompt in `prompts/`, with the prompt verbatim, outcome, decisions, and commit hash. The hash is backfilled during the next prompt's commit. | (a) Amend the commit to include its hash — impossible, amending changes the hash. (b) A separate "record hash" commit after every prompt — doubles commit noise. | Keeps one meaningful commit per prompt while still linking every prompt to its commit. | [001](../prompts/001-setup-prompts-and-docs.md) |
| D-002 | 2026-10-19 | Clone and read third-party skills (README, INSTALL, SKILL.md) before installing them. | Install blindly from the link. | The skills change agent behavior and run hooks on my machine. Reading first is basic supply-chain hygiene, and it shows how each skill would interact with the documentation requirement: caveman exempts docs and commits, so there's no conflict. | [002](../prompts/002-start-planning.md) |
| D-003 | 2026-10-19 | A branch per feature or fix: `planning/*`, `feat/*`, `fix/*`, `docs/*`, `chore/*`. Merged into `main` once done. | Commit straight to `main`. | Each milestone is a reviewable unit with its own history. Requested by the user. | [003](../prompts/003-log-all-prompts-branching-skill-install.md) |
| D-004 | 2026-10-19 | The agent installs caveman and ponytail itself through `claude plugin …`, and also documents the manual steps in `docs/setup-skills.md`. | Ask the user to run the `/plugin` slash commands. | The agent had wrongly claimed the plugins could only be installed through slash commands. Checking the CLI showed it could install them, so it did. The docs keep the setup reproducible for reviewers. | [003](../prompts/003-log-all-prompts-branching-skill-install.md) |
