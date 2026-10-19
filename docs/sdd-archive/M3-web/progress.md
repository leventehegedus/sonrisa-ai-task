# SDD ledger — plan: docs/superpowers/plans/2026-10-19-world-alerts.md

Spec: docs/superpowers/specs/2026-10-19-world-alerts-design.md (reachable, binding)
Workspace isolation: branch `feat/core-engine` in the main checkout (no worktree). The user approved branch-per-feature; a single sequential implementer means no parallel-conflict risk.
Ruling: the workspace is archived to `docs/sdd-archive/<milestone>/` at each milestone gate instead of being deleted — the user wants intermediate outputs as evidence — cost if wrong: a few hundred KB of extra docs.

## Pre-flight scan

| Pair / task | Produces → consumes | Finding | Ruling |
|---|---|---|---|
| T1→T2 | `ScoreBreakdown` (incl. `fires`), `ProximityReason` → `score()` | consistent | — |
| T2→T3 | `score(event, home, threshold)` → `evaluate()` | consistent | — |
| T1,T3→T5 | `Rule`/`User` types → `ingest` must load rules and users from SQL rows | no task owns row→type mapping; T9 also needs it | R-P5: `db/rows.ts` in T5, reused |
| T4→T5 | `NewEvent[]` → `ingest(db, events, now)` | consistent | — |
| T6→T7 | `ChannelAdapter`, `buildMessage(event, b)`, `scrubSecrets` → dispatcher | consistent | — |
| T5→T7 | `server/test/helpers.ts` factories → dispatch tests | consistent | — |
| T7→T8 | `dispatchPending` → `runTick` | consistent | — |
| T4,T5→T8 | `sourceAdapters`, `ingest` → `pollSource` | consistent | — |
| T6→T9 | registry, `maskConfig`, `buildMessage` → channel routes and test endpoint | consistent | — |
| T4,T5,T8→T10 | `manualEvent`, `ingest`, `pollSource` → admin routes | consistent | — |
| T1→T11 | root `package.json` workspaces/scripts | T1 lists `web` before it exists, and `dev` uses `concurrently` | R-P4 |
| T9/T10→T11 | route list → RTK endpoints | consistent | — |
| T11→T12 | `setUser` "action" vs "thunk that resets the API state" | self-inconsistent naming | Ruling: `setUser` is the reducer action; `switchUser(id)` is the thunk (setUser + `api.util.resetApiState()`); UI calls `switchUser` — cost if wrong: a rename |
| T1 self | tsconfig/module system unstated; TypeScript 7 is a new major | ambiguity | R-P1, R-P3 |
| all tasks | the plan has no typecheck step; vitest strips types without checking them | gap | R-P2 |
| T2 self | says "13 scoring cases"; the list has 12 rows + 2 XK cases = 14 | count slip | Ruling: 14; the count isn't a requirement — cost: none |
| T4 self | fixture counts (225 / 3 empty iso3 / 1 Red / 5 Orange / 50 telex / first = 1572503:Green VU) | controller verified each against the fixture on 2026-10-19 | — |
| T6 self | `z.url().startsWith` may not exist in zod 4 | API uncertainty | R-P6 |
| T14 self | `@playwright/test` not listed as a dependency | gap | Ruling: T14 adds it as a root devDependency — cost: none |
| T10 self | inject HU 0.6 → 2 deliveries (Anna, Bence; Priya NP gets 0.12) | controller recomputed: correct | — |

## Progress
Task 1: minor (deferred): server dev script points at src/index.ts (plan: Task 10 sets `tsx watch src/main.ts`)
Task 1: minor (deferred): NULL channel_id bypasses UNIQUE(event_id, channel_id) — ingest/dispatch must never insert NULL channel_id
Task 1: minor (deferred): no test that deliveries.rule_id → NULL on rule delete; no indexes on deliveries(status,next_attempt_at)
Task 1: complete (commits d6fa4aa..40d754c, review clean)
Ruling: commit trailers name the model that actually authored the commit (Sonnet trailer on 65da286 kept, not amended) — honest attribution beats a uniform trailer — cost if wrong: cosmetic
Task 2: minor (deferred): scoring.test.ts:43 title claims "AQ vs AQ is home" but doesn't assert it (misleading test name)
Task 2: minor (deferred): epsilon test covers only the just-below side
Task 2: complete (commits 40d754c..65da286, review clean; controller re-ran suite + typecheck)
Task 3: Ruling: R-P9 added — RED must be assertion failures via stubs — closes the evidence gap the Task 3 review found for all later tasks — cost if wrong: one extra step per task
Task 3: fix round 1/5 (1 addressed, 0 open — RED evidence gap closed by 3 mutation checks, all caught; no new commits)
Task 3: minor (deferred): keyword can match across title/summary boundary (controller-specified join)
Task 3: complete (commits 65da286..70b1ea1, review clean after fix round 1)
Task 4: Ruling: review Minor 1 (z.url accepts javascript:/file:) upgraded to Important — event.url is rendered as a link in the web UI and sent in alerts (XSS / phishing vector via admin inject or hostile feed) — cost if wrong: a one-line refine
Task 4: Ruling: review Minor 4 (externalId '' when no guid/link/title) upgraded to Important — empty ids collide on UNIQUE(source, external_id) and silently drop later events — cost if wrong: one line + test
Task 4: minor (deferred): tags stripped before entity decode → double-encoded HTML survives as tags (summaries rendered as text, not HTML; revisit if HTML email)
Task 4: minor (deferred): valid empty <channel/> throws instead of returning []
Task 4: minor (deferred): coin missing from body skipped silently vs null change rejects whole body (inconsistent)
Task 4: minor (deferred): tests lack 23:30Z UTC-date case and 3% boundary case
Task 4: fix round 1/5 (3 addressed, 0 open — prototype-key severity, http(s)-only urls incl. GDACS links, skip id-less RSS items; commits 609d5a4..37a2332)
Task 4: minor (deferred): skipped id-less RSS items are silent (no count/log)
Task 4: complete (commits 70b1ea1..37a2332, review clean after fix round 1)
Task 5: minor (deferred): ingest.ts:21 `(r as any).id` — map with rowToUser first
Task 5: minor (deferred): rows.ts untyped row param lacks shortcut: comment; no raw round-trip assertion
Task 5: complete (commits 37a2332..e60416f, review clean)
Task 6: Ruling: spec §10 "outbox mode writes each message to the log" is binding over the brief's omission — email adapter gets `log` and logs one line (to + subject, no secrets) in outbox mode — cost if wrong: one log line
Task 6: Ruling: Minor "slack fetch has no timeout" upgraded to Important — scheduler tick is re-entrancy-guarded and sequential, so one hung webhook stalls all polling and dispatch — AbortSignal.timeout(10_000) — cost if wrong: none
Task 6: Ruling: also wrap fetch rejections as `Slack request failed: <err.name>` (no message passthrough) — cheap defence in depth for secret leakage — cost if wrong: less detailed error text
Task 6: minor (deferred): no look-alike-host regression test for slack schema; ENAMETOOLONG for very long addresses; transport recreated per send; String(info.message) cast
Task 6: fix round 1/5 (5 addressed, 0 open — outbox overwrite, vacuous traversal tests, outbox log, slack timeout, fetch error wrapping; commits 163c627..cda7af5)
Task 6: complete (commits e60416f..cda7af5, review clean after fix round 1)
Task 7: Ruling: Minor "markSent inside same try as send → DB error after a successful send causes retry + duplicate send" upgraded to Important — duplicate alerts are a spec anti-goal (§4) — cost if wrong: small restructure
Task 7: Ruling: Minor "corrupt score_breakdown / missing event retried as transient" upgraded to Important, bundled with the above (same code region) — permanent failures must not retry — cost if wrong: one branch + test
Task 7: minor (deferred): non-Error throws untested; 50-row LIMIT untested; `void user; void channel;` noise in dispatch.test.ts:180; nonexistent channel row reported as 'channel disabled'
Task 7: Ruling: accept at-least-once delivery when the DB write after a successful send fails (implementer concern) — exactly-once to an external webhook is not achievable without idempotency keys on the receiver; SQLite in-process write failure is rare — final review should check a `shortcut:` comment documents it — cost if wrong: a rare duplicate alert
Task 7: fix round 1/5 (2 addressed, 0 open — mark-sent outside retry path, corrupt data fails immediately; commits a386134..f33a00e)
Task 7: complete (commits cda7af5..f33a00e, review clean after fix round 1) — carry to Task 8: runTick must catch+log dispatchPending/poll errors (no unhandled rejection)
Task 8: minor (deferred): throwing deps.log rejects the tick (add catch in tick); drop-deliveries test lacks assertions; final UPDATE failure reports inserted:0 after commit; malformed last_polled_at → julianday NULL → never due; row:any in poll.ts; 'poll error:' branch untested; sequential slow sources delay dispatch
Task 8: complete (commits f33a00e..74b1ec1, review clean)
Final M1 review: With fixes — I1 first-poll flood, I2 market once-per-day defect (plan/spec), I3 slack mrkdwn injection, I4 channels.type CHECK vs extensibility; M1 missing shortcut comment (ruling), M2 no full-chain test, M7 throwing log crashes process
Ruling: I1 — two guards: (a) first poll of a source (last_polled_at IS NULL) is a baseline: events stored, no deliveries; (b) events whose occurredAt is older than 24h at ingest time never create deliveries (covers restart after downtime) — manual inject unaffected (occurredAt = now) — cost if wrong: a user misses alerts for items already in the feed at first start (intended)
Ruling: I2 — spec §7 amended: coingecko externalId = `coin:YYYY-MM-DD:band`, band = highest of 3/4/6 (%) reached by abs(change); a move crossing into a higher band the same day creates a new event and can alert; severity formula unchanged — mirrors the approved GDACS escalation pattern; worst case 3 market alerts per coin per day — cost if wrong: spec text + one function
Ruling: I3 — escape & < > in every untrusted field placed in Slack text (title, summary, reason, url) — cost if wrong: none
Ruling: I4 — drop CHECK on channels.type; validity = presence in the channel registry (API validates in M2, dispatcher already fails unknown types); fresh DB so no migration needed — cost if wrong: invalid types caught one layer later
Ruling: M1, M2, M7 included in the fix wave (shortcut comment + accurate comment; one full-chain test fixture→poll→ingest→dispatch→outbox; tick catches a throwing log). Remaining minors (M3–M6, M8–M10) deferred to M2/backlog.
Final M1 fix wave: 7/7 addressed (commits 8304a4e..5108e3a); re-review: Ready to merge = Yes
Ruling: B1 (failed first poll writes last_polled_at → baseline lost → next success floods up to 24h of items) — no second fix wave per process; fixed on its own branch `fix/poll-baseline` immediately after the M1 merge, with its own task review — cost if wrong: none (main never runs the server before M2)
Final M1: deferred to backlog: NaN occurredAt passes 24h guard (isoDate prevents today); bands ignore direction; minChangePct<3 labels band 3; M3–M6, M8–M10 from final review
Fix B1: complete (commits af9995a..6f0c310, review clean) — minor (deferred): garbage-body test should assert baseline_at null; deps.now() called twice in poll.ts:26-27; schema has no migrations (shortcut note missing)
Task 9: re-dispatched fresh after user interruption (partial attempt preserved in docs/sdd-archive/M2-api/interrupted-task-9-partial.patch); base 0350486
Task 9: Ruling: seed keyword lists `['rendkívüli','breaking']` (HU feeds) / `['breaking']` (BBC) accepted as implementer's call — spec gives none — cost if wrong: config tweak
Task 9: Ruling: extra GET /api/rules/:id and /api/channels/:id accepted — implied by the 404-ownership ruling, tiny — cost if wrong: two unused routes
Task 9: minor (deferred): auth as preHandler → unauthenticated malformed JSON gets 400 not 401 (move to onRequest + test); UPDATE/DELETE statements lack `AND user_id = ?` (defensive); seed doesn't validate webhook; /my/deliveries loses history when both channel+rule deleted (shortcut → deliveries.user_id); malformed-JSON 400 lacks issues; 4xx passthrough keyed on statusCode only (app.ts:127); test-send scrub doesn't cover SMTP_URL; masked() lacks Object.hasOwn; LIMIT 100 lacks shortcut comment; no test that test-send scrubs a thrown webhook-bearing error
Task 9: complete (commits 0350486..708ba70, review clean)
Task 10: minor (deferred): main.ts app.close() reject skips db.close (try/finally); scheduler starts before listen (reorder); "unknown id → 404" tests can't distinguish handler 404 from missing route; manual poll can overlap scheduler poll (harmless); RED evidence's 2nd passing test unnamed
Task 10: complete (commits 708ba70..fff5f8a, review clean)
Final M2 review (fable model; first opus attempt was blocked by an API safety false positive): With fixes — I-1 masked Slack URL passes schema → PATCH round-trip overwrites secret
Ruling: I-1 — slack schema requires prefix `https://hooks.slack.com/services/` and rejects any value containing `…`; PATCH round-trip test (GET → PATCH same config → 400, secret unchanged) — cost if wrong: none
Ruling: M-1 — rename PATCH source body field `poll_interval_s` → `pollIntervalS` (API camelCase everywhere); plan amendment D-020 — cost if wrong: one field name
Ruling: M-2 — start scheduler only after `listen` succeeds — avoids a second instance dispatching on EADDRINUSE — cost if wrong: none
Ruling: M-6 — add `// shortcut:` on LIMIT 100; M-9 — default DB_PATH and outbox resolve to repo-root `data/` (spec §10, README) regardless of cwd — cost if wrong: path change
Final M2: deferred: M-3 (UI treats issues optional), M-4, M-5, M-7, M-8, Task 9/10 minors as triaged
Final M2 fix wave: 5/5 addressed (commit 37c0b4d); re-review: Ready to merge = Yes
Carry to M3: UI must OMIT config on channel PATCH unless the user typed a new one (masked value now 400s); treat `issues` as optional in error bodies; uppercase ISO2 country input; PATCH source uses `pollIntervalS`
Task 11: first dispatch interrupted by user (partial: web/ scaffold, root package.json edits; no report, no commit) — preserved: docs/sdd-archive/M3-web/interrupted-task-11-partial.patch + stash@{0}
Ruling: Task 11 NOT re-dispatched this session — user is near the session limit; a third half-finished interrupted subagent would be worse than a clean stop — resume point: re-dispatch Task 11 fresh from feat/web @ HEAD with the prompt saved at docs/sdd-archive/M3-web/task-11-dispatch.md
Task 11a: dispatched (base aa0b23f); Task 11 split per D-023
Task 11a: controller check — 'cn' npm package is official (maintainer shadcn <m@shadcn.com>, repo shadcn-ui/cn), generated by shadcn CLI 4.22.1; note: v0.5.0 modified 2026-10-16 (very new)
Task 11a: minor (deferred): unused lucide-react (shadcn iconLibrary default); root typecheck covers server only; loading/error UI not viewed in a browser; root package.json reformatted
Task 11a: complete (commits aa0b23f..96d8e66, review clean). Next: 11b (Redux/RTK Query) and 11c (switcher/shell) — user to rethink first (prompt 016)
Ruling (user, D-024): from prompt 018 on, subagents use sonnet/haiku only — see CLAUDE.md model policy; final reviews on sonnet with named risks
Task 11b: base 185d82d
Ruling: live checks must not touch the user's running instance (:3000/:5173, data/alerts.db) — use PORT=3001 for the API and vite --port 5174 with a configurable proxy target (env API_TARGET, default http://localhost:3000) — added to Task 11c — cost if wrong: one env var
Task 11b: Ruling: baseUrl `${location.origin}/api` accepted (Node undici Request rejects relative URLs; jsdom url option doesn't help per reviewer) — cost if wrong: split-origin deploy needs configurable base (non-goal)
Task 11b: minor (deferred): no tests for localStorage fallbacks / getUsers / /users 401; load() accepts any positive int (e.g. 999 → 401 page)
Task 11b: minor → folded into 11c: `switchUser(2) as never` typing gap — type the thunk against AppDispatch
Task 11b: complete (commits 185d82d..265d6a1, review clean)
Task 11c: implementer hand-back message was only 'placeholder' — controller verified state directly (commit 4213c6a, report present, ports free)
Task 11c: fix round 1/5 (Important blank-panel ADDRESSED; bundled Minor placeholder NOT addressed — Radix shows placeholder only for empty value; re-review verified in radix source)
Ruling: placeholder fix + stale-tab reset folded into Task 12 dispatch (Minor; saves a round per D-024) — cost if wrong: brief blank trigger until Task 12
Task 11c: complete (commits 265d6a1..43c9e28)
Task 12: R-P9 miss — page tests had no RED run; reviewer mutation (delete setTab reset) proved tab-reset test guards behaviour; exact-body assertions judged non-vacuous — logged as R-021
Task 12: minor (deferred): no tests for threshold Slider / editing existing rule; delete has no confirm; MyDeliveries never invalidated (fine)
Task 12: minor → folded into Task 13: admin→admin switch bounces to My alerts while me is undefined after resetApiState (guard fallback with `me &&`)
Task 12: complete (commits 43c9e28..94474bd, review clean)
Task 13: minor (deferred): source Switch has no error handling; interval no client guard (cleared → 0 → server 400 shown as toast); inject dialog error not cleared on close; no Deliveries status-filter test; /me failure leaves admin tab blank
Task 13: complete (commits 94474bd..0e26752, review clean)
Final M3 review (sonnet + real Chromium walkthrough via Playwright MCP): Ready to merge = Yes; favicon 404 folded into Task 14
