### Task 3: Rule matching

**Files:**
- Create: `server/src/matching/index.ts`
- Test: `server/test/matching.test.ts`

**Interfaces:**
- Consumes: `score` (Task 2).
- Produces: `matchesContent(rule: Pick<Rule,'categories'|'keywords'>, event: Pick<NewEvent,'category'|'title'|'summary'>): boolean` and `evaluate(rule: Rule, user: User, event: EventRow): ScoreBreakdown | null`. `evaluate` returns `null` when the rule is disabled or the content doesn't match; otherwise it returns the breakdown, and the caller checks `.fires`.

- [ ] **Step 1: Write the failing tests:**
  - Empty categories and keywords match anything.
  - Category mismatch → false.
  - Keywords use OR, case-insensitive, over title + summary.
  - **Review Focus 4:** keyword `árvíz` matches the title `ÁRVÍZ Szegeden`. Keyword `(BTC)` matches the literal `(BTC)` and does not throw. Keyword `c++` matches `c++`. Use `toLocaleLowerCase('hu')` plus `includes`, with no `RegExp`.
  - A disabled rule → `evaluate` returns `null`.
  - A HU user with a rule threshold of 0.3 and a global 0.5 event → `fires: true`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): rule content matching and evaluation`

