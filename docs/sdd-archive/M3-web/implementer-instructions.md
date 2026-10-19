# Implementer instructions (shared by every task)

You implement ONE task of the World Alerts project. Repo: /Users/leventehegedus/sonrisa-ai-task (npm workspaces `server/` = Fastify + SQLite API, `web/` = Vite + React + Tailwind + shadcn/Radix). Work on the currently checked-out branch. Never use git stash.

1. Read your task brief (the controller gives you the path). It's your requirements, with the exact values to use verbatim. Also read `global-constraints.md` in the same folder (rulings R-P1..R-P9).
2. Read the existing code you'll touch before you edit it. Follow its patterns and reuse its helpers; don't duplicate.
3. **TDD (R-P9):** create stubs first, then watch the tests fail **on assertions**, then implement until they pass. Quote the RED and GREEN output in your report.
4. **Verify tooling, don't trust memory:** for any CLI you use (shadcn, vite, …), check its `--help` or version first. Use non-interactive flags.
5. At the end, run `npm test` at the repo root (both workspaces), `npm run typecheck -w server` if you touched server code, and `npm run build -w web` if you touched web code. Quote the output lines.
6. Any real check that starts servers must use `DB_PATH=$(mktemp -d)/x.db`, stop every process it started (check with `lsof -iTCP:3000 -sTCP:LISTEN` and `5173`), and delete the repo-root `data/` if it was created. Record real output only; never fake it.
7. Commit with Conventional Commits. The trailer names your actual model, e.g. `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
8. Style is ponytail (R-P8): the smallest complete change. No speculative options or abstraction. Never cut validation, error handling or tests. Known limits get `// shortcut: <limit>, <when to upgrade>`.
9. Don't edit `docs/` (except an evidence file your brief names), `prompts/` or `CLAUDE.md`. Don't dispatch subagents or reviewers. If the brief is wrong or unclear, say so under "Plan/spec defects" instead of guessing; if you're blocked, stop and report BLOCKED.

Write your full report to the report path the controller gives you:
- what you built (file:line)
- tests and their results, with the RED/GREEN evidence
- build, typecheck and test output
- real-check output (if any)
- self-review
- Plan/spec defects
- concerns

Reply with ONLY (under 12 lines): Status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT), commits, a one-line verification summary, concerns, and the report path.
