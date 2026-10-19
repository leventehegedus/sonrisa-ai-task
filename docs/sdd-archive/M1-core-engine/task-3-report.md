# Task 3 report: Rule matching

Built server/src/matching/index.ts: `matchesContent` (empty categories = all; keywords trimmed, blanks dropped, lowered with toLocaleLowerCase('hu'), OR over `title + ' ' + (summary ?? '')` via includes; no RegExp) and `evaluate` (null if disabled or no content match, else `score(event, user.homeCountry, rule.threshold)`).
Tests: server/test/matching.test.ts, 9 tests (brief cases plus blank-keyword cases, non-matching content -> null).

TDD: RED = `npx vitest run test/matching.test.ts` -> "1 failed ... no tests" (module ../src/matching missing). GREEN = "9 passed (9)".
Typecheck: `npm run typecheck -w server` -> tsc --noEmit clean.
Full suite: 4 files, 40 tests passed.
Files: server/src/matching/index.ts, server/test/matching.test.ts. Commit: feat(server): rule content matching and evaluation.
Self-review: minimal, no extras. Plan/spec defects: none. Concerns: none.

## Fix round 1: mutation checks (uncommitted, file restored)
Command each time: `cd server && npx vitest run test/matching.test.ts`
(a) matchesContent ignores keywords (`return true` instead of `if (!keywords.length) return true`): 3 failed | 6 passed.
 - FAIL matchesContent > keywords are OR, case-insensitive, over title and summary: AssertionError: expected true to be false
 - FAIL matchesContent > treats regex metacharacters literally: AssertionError: expected true to be false
 - FAIL matchesContent > ignores blank keywords: AssertionError: expected true to be false
(b) case-sensitive (`lower = s => s`): 2 failed | 7 passed.
 - FAIL ... keywords are OR, case-insensitive, over title and summary: expected false to be true
 - FAIL ... matches accented Hungarian keywords case-insensitively: expected false to be true
(c) evaluate ignores rule.enabled: 1 failed | 8 passed.
 - FAIL evaluate > returns null for a disabled rule: expected { severity: 0.5, proximity: 0.8, ... } to be null
Restore: `git diff --exit-code server/src/matching/index.ts` exit 0; rerun: 9 passed (9).
All mutations killed; no new tests needed, no new commit.
