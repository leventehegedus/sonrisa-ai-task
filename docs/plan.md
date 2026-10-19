# Plan of Attack

> The brief asks for a plan that shows *how the work is scoped and structured*: which deliverables, in what order, and why. This is that plan. The detailed, test-first task breakdown lives in [`superpowers/plans/2026-10-19-world-alerts.md`](superpowers/plans/2026-10-19-world-alerts.md).

## 1. How I read the brief

The brief is a vague, one-paragraph PM request, and the evaluation explicitly grades **process over product**. So the plan optimizes for three things:

1. **Turning ambiguity into explicit, logged decisions.** Every guess is labelled as a guess, and the user confirms or corrects it.
2. **Verifying AI output before accepting it.** Feeds are probed live, datasets are cross-checked against their authoritative source, math is recomputed by a script, and a cold-read reviewer checks every design and every milestone.
3. **A thin, working, end-to-end slice** that is easy to defend, rather than a broad feature set.

## 2. What the brief leaves undefined, and how each gap was closed

| Gap in the brief | Resolution | Where |
|---|---|---|
| What is "something important"? | A transparent score: `severity × region proximity`, with a critical override for severity ≥ 0.9. The user's home country weighs most. | D-007, D-009 |
| Where does the data come from? | Live, free, no-key feeds, each **probed before it was chosen**: GDACS (disasters), CoinGecko (markets), country-tagged RSS (news). Plus an admin "inject event" for reliable demos. | D-008 |
| How are events detected? | Poll, normalize to one event shape, dedup, score per user, write an outbox. Rules filter by category and keywords; region feeds the score instead of filtering. | design §9 |
| "Email and Slack, more channels later" | A `ChannelAdapter` interface: one file plus one registry line per channel. | design §10 |
| "An admin view" | Users, rules, events, the delivery log (score breakdown + retry), source toggles and poll-now, inject event. | D-007 |
| Who is the user, and is there auth? | Seeded users with a header-based user switcher. Not authentication; documented as a deliberate shortcut. | design §3 |

## 3. Deliverables

| # | Deliverable | Status |
|---|---|---|
| 1 | Process scaffolding: prompt log, decision log, AI review log, branch-per-feature | done |
| 2 | Design spec, approved by the user and checked by a builder | done |
| 3 | This plan, plus the detailed TDD implementation plan | done |
| 4 | `CLAUDE.md`: agent operating rules for this repo | done |
| 5 | Core engine: sources, scoring, matching, ingest, channels, dispatcher, poller | M1 |
| 6 | HTTP API: user and admin routes, validation, seed data | M2 |
| 7 | Web UI: user pages and admin pages | M3 |
| 8 | Evidence: screenshots, a verification report (spec goal → proof → result), README | M4 |

## 4. Order of work, and why

```
Planning ──► M1 Core engine ──► M2 API ──► M3 Web UI ──► M4 Evidence
 (done)      feat/core-engine   feat/api    feat/web     chore/e2e-evidence
```

1. **Planning before code.** The brief's risk is building the wrong thing. The design surfaced two real errors before any code existed: the first-draft scoring that would never alert (R-004), and a non-M49 dataset that would have flipped an approved example (R-009).
2. **The core engine first, without HTTP.** Scoring, matching and dedup are where correctness matters and where the AI is most likely to be plausibly wrong. As pure functions they can be tested against the 12 worked examples from the spec and against **real saved feed payloads**.
3. **The API next.** It's a thin layer that validates input at the trust boundary (zod) and masks secrets. Tests use `fastify.inject`, so no server has to run.
4. **The UI last.** It has the least logic and the most generated boilerplate, so it's the least risky. The server already enforces the rules, so the UI can't break them.
5. **Evidence at the end of each milestone,** not only at the end: tests are green, a fresh review subagent checks the work, and its findings are written down.

## 5. Time budget (about 24 h)

| Phase | Budget |
|---|---|
| Planning, design and verification of sources and data | 4 h |
| M1 core engine | 7 h |
| M2 API | 4 h |
| M3 Web UI | 5 h |
| M4 evidence, README, final review | 3 h |
| Buffer | 1 h |

If time runs short, **M3 is cut down before M1 or M2 lose tests**: a partial UI over a verified engine beats a full UI over an unverified one.

## 6. How AI output gets validated

| Check | Applied to |
|---|---|
| **Live probe** of every external endpoint before it's designed in | feeds (R-002, R-003) |
| **Cross-check against an authoritative source,** never a table typed from AI memory | the M49 region dataset (R-009, `docs/evidence/m49-check/`) |
| **Recompute by script** any number the AI writes in a doc | the scoring table (R-004, R-005) |
| **Cold-read builder check** by a fresh subagent with no conversation context | the design spec |
| **TDD:** the test is written and seen failing before the implementation | every engine and API task |
| **Fixtures are real captured payloads,** not AI-invented samples | source adapters |
| **Milestone review subagent** with written triage (accepted / rejected, and why) | each branch before merging |
| **Verification report** mapping each spec goal to its proof, including what was *not* verified | M4 |

Every rejection or correction goes in [`ai-review-log.md`](ai-review-log.md).

## 7. Known risks

| Risk | Mitigation |
|---|---|
| News severity is crude, because RSS has no importance signal | Documented as a `shortcut:`; LLM scoring is the upgrade path (non-goal for v1) |
| Live feeds change or go down during a demo | Saved fixtures for the tests; admin inject for demos; each source's failure is isolated (Review Focus 1) |
| `better-sqlite3` native build on Node 24 | Checked in Task 1 Step 1; stop and log it if it fails |
| No real Slack workspace | Dry-run mode, and the verification report says plainly that real delivery wasn't tested |
| Generated UI boilerplate hides bugs | The UI holds no business logic; the server enforces it and is tested |
