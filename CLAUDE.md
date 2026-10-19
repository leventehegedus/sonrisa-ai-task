# CLAUDE.md

Rules for AI agents working in this repo. Read this first, every session.

## What this repo is

A take-home submission ([`docs/task-brief.md`](docs/task-brief.md)): **World Alerts**. Users get email or Slack alerts for important world events (news, markets, disasters), weighted by how close each event is to their home country, plus an admin view.

**The graders judge the process, not the product.** Every prompt, decision, rejected AI output and verification step must leave a trace in the repo.

| Doc | What it holds |
|---|---|
| [`docs/plan.md`](docs/plan.md) | Plan of attack: deliverables, order, why |
| [`docs/superpowers/specs/2026-10-19-world-alerts-design.md`](docs/superpowers/specs/2026-10-19-world-alerts-design.md) | The approved design (source of truth for behavior) |
| [`docs/superpowers/plans/2026-10-19-world-alerts.md`](docs/superpowers/plans/2026-10-19-world-alerts.md) | TDD task plan, Tasks 1–14 |
| [`docs/decisions.md`](docs/decisions.md) | Decision log (D-NNN) |
| [`docs/ai-review-log.md`](docs/ai-review-log.md) | AI output that was rejected or corrected (R-NNN) |
| [`prompts/`](prompts/) | Every user prompt, verbatim |

## Process rules (mandatory, every turn)

1. **Log every user prompt** verbatim as `prompts/NNN-slug.md` (sections: Prompt, Outcome, Decisions, Commit), and add a row to `prompts/README.md`. That includes short answers like "ok".
2. **Log decisions** in `docs/decisions.md`: what was chosen, the alternatives, the rationale and the prompt link. Mark your own calls as *(Agent's call)*.
3. **Log AI mistakes** in `docs/ai-review-log.md` whenever an AI output (yours or a subagent's) turns out wrong, unverified or incomplete: what was claimed, how it was caught, the fix.
4. **Commit at the end of every prompt.** Backfill the previous prompt's hash into its file and the index as part of this commit. A commit can't contain its own hash.
5. **A branch per feature or fix:** `feat/*`, `fix/*`, `docs/*`, `chore/*`, `planning/*`. Never commit straight to `main`. Merge only after `npm test` is green and a review subagent's findings have been triaged in writing.
6. Commit messages: Conventional Commits, ending with the `Co-Authored-By` trailer.

## Verification rules

- **Never trust memory for external facts.** Probe APIs live (`curl`), check package versions with `npm view`, and read the real data. Save evidence under `docs/evidence/`.
- **Never hand-type reference data** (country tables, codes). Use the committed authoritative file: `server/src/geo/m49.csv`, verified against the UN M49 page.
- **Recompute any number** you write in a doc with a script.
- **TDD:** write the test, watch it fail, implement, watch it pass. Source adapter tests use the saved real payloads.
- **Don't claim "done", "works" or "passing"** without the command output that shows it. Say plainly what wasn't verified (for example "Slack tested in dry-run only").

## Skills

- **superpowers:** brainstorming → spec → writing-plans → subagent-driven-development or executing-plans → requesting-code-review → finishing-a-development-branch. Use test-driven-development and verification-before-completion throughout.
- **ponytail (full):** the smallest complete change. No speculative abstractions, options or "for later" code. Never cut validation, error handling, security or tests. Known limits get `// shortcut: <limit>, <when to upgrade>`.
- **caveman:** terse **chat** replies only. Docs, commits, code comments and prompt logs stay in full, clear prose.

## Model policy for agents (user decision, D-024; applies from prompt 018 on)

The user talks to the main session on **Opus**. To avoid rate limits, every subagent uses a cheaper model, and **the model is always set explicitly** (an omitted model inherits Opus).

| Role | Model |
|---|---|
| Main session (controller: planning, rulings, talking to the user) | opus (the session model) |
| Implementer: multi-file feature, tests, integration | `sonnet` |
| Implementer: mechanical (1–2 files, complete spec, config, renames) | `haiku` |
| Task reviewer | `sonnet` |
| Scoped re-review of a small fix diff | `haiku` |
| Whole-branch / milestone review | `sonnet`, with a focused list of named risks (no Opus) |
| Read-only search / exploration | `haiku` (Explore agent) |

To keep the call count low:
- Batch small, same-shaped fixes into one dispatch.
- Pass artifacts as files, not pasted text.
- Use one review per task; a re-review only after a fix round.
- Keep controller turns short: no reading whole files the subagent will read anyway.

## Stack and commands

- Server: Node 24, TypeScript, Fastify 5, better-sqlite3 (plain SQL, no ORM), zod 4, fast-xml-parser, nodemailer, vitest.
- Web: Vite, React 19, Redux Toolkit + RTK Query, Tailwind 4, shadcn/ui (Radix).
- `npm install` · `npm run dev` (server :3000 + web :5173) · `npm test` · `npm run build -w web`
- Env: `PORT`, `DB_PATH` (default `data/alerts.db`), `SMTP_URL` (unset = JSON outbox in `data/outbox/`), `SLACK_DRY_RUN` (default `1`), `SEED_SLACK_WEBHOOK`.

## Code conventions

- Validate every HTTP input with zod at the route. Invalid input → `400 { error, issues }`.
- Secrets (Slack webhook URL, SMTP URL) are never returned by the API or logged: use `maskConfig` and `scrubSecrets`.
- Scoring constants live only in `server/src/scoring/weights.ts`.
- Pipeline stages are functions of `(db, …, now)`. Inject `now` and `fetchImpl`; no hidden clocks or network in the logic.
- Identity is the `X-User-Id` header. That is a dev shortcut, **not** auth; don't build on it as if it were secure.
