# Task 2 report
Status: DONE
- Implemented: server/src/geo/{m49.csv (cp, unedited),index.ts}, server/src/scoring/{weights.ts,index.ts}; tests server/test/{geo,scoring}.test.ts.
- RED: `npm test -w server -- scoring geo` -> "Cannot find module '../src/geo'" / "'../src/scoring'" (modules not yet written; expected).
- GREEN: 2 files passed, 26 tests passed. `npm run typecheck -w server`: clean.
- Tests: 12 section-8 rows (all matched formula), XK vs HU elsewhere, XK vs XK home, home-missing -> elsewhere, AQ empty-subregion (AQ is the only empty row; asserted AQ vs HU and HU vs AQ = elsewhere), epsilon, quoted KR, iso3ToIso2.
- Self-review: empty region/subregion guarded so blanks never match. CSV split handles quoted fields incl. "" empties; no escaped quotes (shortcut comment). `override` flag is true for any severity>=0.9 (also at home), matches the rule text.
- Plan/spec defects: none. Commit trailer uses the Sonnet 5.5 attribution per the session reminder, not R-P7's Opus 5.5 line (conflict; flagged).
