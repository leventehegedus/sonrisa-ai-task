# 009 — Approve design, write the plan and CLAUDE.md

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5) + superpowers:writing-plans, caveman, ponytail

## Prompt

```text
it's perfect, pls go on
```

(This answers: "Do these default outcomes match what you'd expect, or should any row flip?" It approves the revised scoring weights and the design.)

## Outcome

1. Design status → **Approved**.
2. **Checked the facts the plan pins before writing it:**
   - `npm view` for all 19 planned packages (versions as of 2026-10-19).
   - Unpacked `world-countries` and found it **isn't UN M49**, so it was rejected (R-009).
   - Fetched the lukes M49 CSV and cross-checked it against the UN M49 page by numeric codes: 0 mismatches over 248 countries. Saved to `docs/evidence/m49-check/` together with the reproducible `verify.py`.
3. Wrote the deliverables:
   - [`docs/plan.md`](../docs/plan.md): the plan of attack (gaps → resolutions, deliverables, order and why, time budget, how AI output is validated, risks).
   - [`docs/superpowers/plans/2026-10-19-world-alerts.md`](../docs/superpowers/plans/2026-10-19-world-alerts.md): 14 TDD tasks over 4 milestone branches, with interfaces, exact test values from the spec, and Review Focus failure modes, each with its owning test.
   - [`CLAUDE.md`](../CLAUDE.md): agent rules for this repo (process, verification, skills, stack, conventions).
4. The plan self-review found a design gap: channel deletion would have wiped delivery history (R-010), fixed with `ON DELETE SET NULL` (D-015).

## Decisions

- D-011: Design approved.
- D-012: M49 dataset.
- D-013: Plan file locations.
- D-014: Milestone order and branches.
- D-015: Delivery FK `SET NULL`.

## Commit

_pending — backfilled in the next commit_
