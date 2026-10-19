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
| 002 | [Start the planning phase](002-start-planning.md) | `d0ff1bf` |
| 003 | [Log all prompts, branch per feature, skill install](003-log-all-prompts-branching-skill-install.md) | `d0ff1bf` |
| 004 | [Reload plugins](004-reload-plugins.md) | `6875ac3` |
| 005 | ["Let's start planning"](005-start-planning-go.md) | `e55c1b1` |
| 006 | [Stack choice](006-stack-choice.md) | `e2e84d8` |
| 007 | [Confirm guesses + region weighting](007-confirm-guesses-region-weighting.md) | `2fce833` |
| 008 | [Far-away critical events + builder check](008-far-away-critical-events-and-builder-check.md) | `89fec52` |
| 009 | [Approve design, write plan + CLAUDE.md](009-approve-design-write-plan.md) | `02ece55` |
| 010 | [Execute subagent-driven; merge planning](010-execute-subagent-driven-merge.md) | `b4a93f7` … `8a9ed68` |
| 011 | [What caused the interruption? Status of tasks](011-interruption-and-status.md) | `0350486` |
| 012 | [Wider summary with explanations, then continue](012-progress-summary-and-continue.md) | `0350486` … `a785991` |
| 013 | [Explain the second interruption](013-second-interruption.md) | `c9e877d` |
| 014 | [Finish Task 11 or wait; how to test](014-how-to-test-and-pause.md) | `c9e877d` |
| 015 | [Break down Task 11 to rethink it](015-break-down-task-11.md) | `68400c6` |
| 016 | [Split Task 11; do 11a, skip Redux](016-split-task-11-do-11a.md) | `aa0b23f` · `96d8e66` |
| 017 | [How to start the backend and the database](017-how-to-start-backend-db.md) | `2c8a300` |
| 018 | [Cheaper models for subagents](018-cheaper-models-for-subagents.md) | `1e51556` |
| 019 | [What to test now; what the web UI shows](019-what-to-test-in-web-ui.md) | `f52ea7e` |
| 020 | [Continue Task 11, subtasks, then the rest](020-continue-task-11-and-rest.md) | `185d82d` … `e480c46` |
| 021 | [Check and drop the two stashes](021-check-and-drop-stashes.md) | `9b0c265` |
| 022 | [Testing walkthrough + requirements checklist](022-testing-walkthrough-and-checklist.md) | `81bedb5` |
| 023 | [Will Send test reach my real email?](023-real-email-on-send-test.md) | `b4ca357` |
| 024 | [Set up SMTP so real email can be tested](024-set-up-real-smtp.md) | `4ef0659` |
| 025 | [Gmail App password: real email verified](025-gmail-app-password-test.md) | `9e1f929` |
| 026 | [Slack: step-by-step setup](026-slack-step-by-step.md) | `60b6695` |
| 027 | [Slack webhook: real delivery test](027-slack-webhook-test.md) | _pending_ |
