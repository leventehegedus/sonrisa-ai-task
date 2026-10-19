## Global Constraints

- Node `>=24`. Pin dependency **major** versions to the ones checked on 2026-10-19: fastify 5, better-sqlite3 13, zod 4, vitest 5, nodemailer 10, fast-xml-parser 5, vite 8, react 19, @reduxjs/toolkit 2, tailwindcss 4. If an install or API doesn't match what this plan says, **stop and log it in `docs/ai-review-log.md`**. Don't silently switch libraries.
- No ORM. Plain SQL through `better-sqlite3`. Schema in `server/src/db/schema.sql`.
- Every HTTP body, query and path param is parsed with zod. Invalid input → `400 { error, issues }`.
- Secrets: a Slack `webhookUrl` and `SMTP_URL` never appear in API responses (masked as `https://hooks.slack.com/…/XXXX`, i.e. only the last 4 chars) or in logs.
- Scoring constants live **only** in `server/src/scoring/weights.ts`: home 1.0, subregion 0.75, continent 0.4, elsewhere 0.2, global 0.8, unknown 0.2, critical override at severity ≥ 0.9, default threshold 0.5. Compare with an epsilon of `1e-9`.
- Region data comes **only** from `server/src/geo/m49.csv` (a copy of `docs/evidence/m49-check/lukes-all-2026-10-19.csv`). Never hand-type country tables.
- Source tests use the **saved real payloads** in `docs/evidence/feed-probes-2026-10-19/`, copied into `server/test/fixtures/`.
- Every `shortcut:` comment uses the format `// shortcut: <limit>, <when to upgrade>`.
- Process (see `CLAUDE.md`): a branch per milestone, TDD, a commit per task, every prompt logged, every rejected or corrected AI output logged in `docs/ai-review-log.md`.

## Review Focus

1. **A feed is down or returns garbage** (HTTP 500, truncated XML, HTML error page). Expected: that source's `last_error` is set, the other sources and the scheduler keep running, and no partial events are inserted. Test owner: Task 8.
2. **A secret leaks through the API or logs.** Expected: `GET /api/channels` and the admin endpoints never return a full Slack webhook URL, and dispatcher error messages are scrubbed of it. Test owners: Task 6 (adapter `maskConfig`, error scrub) and Task 9 (route response).
3. **A channel is deleted while rules or pending deliveries still reference it.** Expected: no crash. Rules drop the ID, and pending deliveries for it become `failed` with `last_error = 'channel deleted'`. Test owner: Task 9 (delete route) and Task 7 (dispatcher).
4. **Hungarian and accented keywords, or regex metacharacters, in keywords** (`árvíz` vs `ÁRVÍZ`, `c++`, `(BTC)`). Expected: case-insensitive Unicode substring match with no regex injection. Test owner: Task 3.
5. **Out-of-range or unknown input** (threshold `1.5`, category `sports`, non-https webhook, a `channelIds` entry owned by another user). Expected: `400`, and nothing is written. Test owner: Task 9.


## Controller pre-flight rulings that bind every task

- R-P1: Module setup: `"type": "module"`, tsconfig `module: "ESNext"`, `moduleResolution: "Bundler"`, `noEmit: true`, `strict: true`. Code runs through tsx/vitest and is never compiled to JS. Imports carry no file extensions.
- R-P2: Every task must also pass `npm run typecheck -w server` (`tsc --noEmit`), not only the tests. Task 1 adds the script.
- R-P3: TypeScript major: try `typescript@latest` (7.x). If `tsc --noEmit` doesn't work or doesn't understand the tsconfig, pin `typescript@^6` (or the latest 5.x) and say so in the report. Don't spend more than one attempt on it.
- R-P4: Task 1 root workspaces = `["server"]` only, and root `dev` runs only the server. Task 11 adds `"web"` and switches `dev` to `concurrently`.
- R-P5: Row mappers `rowToUser`, `rowToRule`, `rowToEvent` (snake_case SQL row → camelCase domain type, with JSON columns parsed) live in `server/src/db/rows.ts`, created by the first task that needs them (Task 5) and reused afterwards. No mapping code is duplicated in route files.
- R-P6: In zod 4, if `z.url().startsWith(...)` isn't available, use `z.url().refine(u => u.startsWith('https://hooks.slack.com/'), ...)`. The behavior is what matters.
- R-P7: Commits: Conventional Commits, and every commit message ends with a `Co-Authored-By: Claude <your actual model, e.g. Sonnet 5.5> <noreply@anthropic.com>` trailer naming the model that wrote the commit. Do not edit `prompts/`, `docs/decisions.md` or `docs/ai-review-log.md`; the controller owns those. If you find that the plan or the spec is factually wrong, say so in your report under "Plan/spec defects".
- R-P8: Code style is ponytail (full): the smallest complete change. No speculative abstraction or options. Never cut validation, error handling, security or tests. Known limits get `// shortcut: <limit>, <when to upgrade>`.
- R-P9: **TDD RED evidence must show assertions failing, not only "module not found".** Create the module first with the exported signatures as stubs (e.g. `throw new Error('not implemented')` or a wrong return value), so the RED run collects the tests and they fail. Quote the failing test names and assertion lines in the report. (Added after the Task 3 review.)
