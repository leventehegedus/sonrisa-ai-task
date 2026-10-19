### Spec Compliance
- ✅ Spec compliant
- ⚠️ Cannot verify from diff: test/typecheck run results (report claims 26 pass, typecheck clean; not re-run). Commit trailer not visible in the diff.
- Checked independently: `cmp` of m49.csv vs docs/evidence/m49-check/lukes-all-2026-10-19.csv is identical. CSV columns used (f[1]=alpha-2, f[2]=alpha-3, f[5]=region, f[6]=sub-region) match the header. Recomputed §8 rows by hand: RO 0.7*0.75=0.525 sent; ES 0.7*0.4=0.28 dropped; BTC-4% (4/6)*0.8=0.5333 sent; NP red 1.0*0.2 -> override 1.0 sent; unknown 0.14 dropped. All match test expectations. All 12 rows are present with correct reason/override/fires. `ScoreBreakdown` in src/types.ts includes importance and fires, which score() returns. Weights, critical severity 0.9, threshold 0.5 and epsilon 1e-9 live only in weights.ts.
- Proximity order matches the controller rule: global, then unknown, then equal-to-home (before the table lookup), then non-empty subregion, then non-empty region, else elsewhere. Empty values never match.
### Strengths
- Small and direct. The CSV parser handles quoted commas. A `shortcut:` comment is in the required format.
- Tests cover XK both ways, AQ (empty region/subregion), a home country missing from the table, an epsilon case, and quoted KR.
### Issues
#### Critical (Must Fix)
None.
#### Important (Should Fix)
None.
#### Minor (Nice to Have)
- server/test/scoring.test.ts:43 The test title says "AQ vs AQ is home" but never asserts it. Add one assertion or fix the title.
- server/test/scoring.test.ts:46 The epsilon test checks only the just-below side (threshold 0.5+1e-10). There is no case showing a clearly higher threshold does not fire. This is cosmetic, because the 12 rows already include dropped cases.
- server/src/geo/index.ts:26 `f[n]!` assumes well-formed rows. This is acceptable for a committed, verified file.
### Assessment
**Task quality:** Approved
**Reasoning:** The implementation is correct against §8 and the controller rulings. The CSV is byte-identical to the evidence file, and the hand-recomputed rows match the tests. Only trivial test polish remains.
