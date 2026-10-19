# Review: a1ae670 (fix/appshell-tab-flake, base ad51de4)

Read-only review of the diff. Tests were not re-run; the controller's 8 green runs are taken as given.

### Verdicts

1. **Test fix: PASS.** `AppShell.test.tsx:27` awaits `findByText(/DE/)` (the new user's home country) before any assertion on tabs. `:30` and `:39-40` wrap the `aria-selected` checks in `waitFor`, so there is no single-shot read after the async switch. Minor caveat: the `/DE/` match depends on the fixture's second user having `homeCountry` DE. A fixture change would break it, but the wait is correct as written.

2. **App fix: PASS.** `AppShell.tsx:141-168`: while `me` is undefined, the Tabs block is not rendered, so there is no selected-less panel. `:99-100` is unchanged, so `active` falls back to `tab` while `me` is undefined and only resets to `alerts` after `me` loads as non-admin. Admin to admin keeps `tab === 'admin'` (`:99`), so the Admin tab stays selected once `me` returns. Side effect: the Tabs subtree unmounts during a `resetApiState` reload, so panel-local state (e.g. an open inject dialog) is lost on a user switch. Acceptable, since the switch already refetches everything. Not a regression.

3. **Error-state concern: CONFIRMED, Minor.** On `/me` error, `me` is undefined and `error` is set. The header shows "API not reachable: HTTP …" with Retry (`AppShell.tsx:113-125`), but the body at `:141-142` shows "Loading…" indefinitely. That contradicts the header and reads as if a request is still in flight. Impact is limited because the header states the real failure and Retry works, so this is Minor, not Important. It is a cheap fix, but the suggested one-liner ("show Loading only when `!me && !error`") is not safe as written. With `error` set and `me` undefined, the Tabs branch would render with `tab` possibly `'admin'`, which is not in `visible`, giving the same blank selected-less panel the fix removes. Use a conditional message instead:
   `{me ? (<Tabs …>…</Tabs>) : <p className="text-muted-foreground">{error ? 'Could not load your session.' : 'Loading…'}</p>}`
   (Restructure the existing `!me ? … : <Tabs>` ternary to this form.)

4. **Formatting churn: Minor, but should be reverted before merge.** `AppShell.tsx` is rewritten end-to-end: 83 changed lines, almost all of them quote style (`'` to `"`) and semicolons, plus reflowed lines (e.g. `:115-118`). The rest of the web code (`AppShell.test.tsx`, `App.tsx`, and the ad51de4 version of `AppShell.tsx`) uses single quotes and no semicolons. The repo has no prettier config, so the run used prettier defaults. The real change is about 10 lines, and the churn hides it from review. Fix: re-format with `--single-quote --no-semi` (or restore the original style by hand) so the diff shows only the `!me` gate.

### New Breakage

- None functional. Tests: the 24 web tests cover the changed paths per the controller's runs. Nothing in the diff touches server code or the API contract.
- Style churn in `AppShell.tsx` (item 4) is the only non-functional breakage: an inconsistent file in the web codebase and a noisy diff.
- Error-state text (item 3) is a user-visible misleading message, not a crash.

### Verdict (Approved | Needs fixes)

**Needs fixes.** Both fixes are small, and neither blocks the flake fix itself:
- Revert the prettier churn in `AppShell.tsx` to the repo's single-quote, no-semicolon style.
- Replace the unconditional "Loading…" with the error-aware message in item 3.
After those, re-run `npx vitest run` once and the build.
