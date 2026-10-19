### Fix: AppShell tab-fallback test flake (and the blank-panel window it exposes)

**Branch:** `fix/appshell-tab-flake` (off main `ad51de4`).

**Diagnosis** (Task 14 reviewer; the controller reproduced it with 4/6 failures of `npm test -w web`):
- `switchUser` calls `api.util.resetApiState()`, so `me` is `undefined` while the new `/me` loads.
- `AppShell` then computes the visible tabs without Admin but keeps `tab === 'admin'`, so no tab is selected and the panel is blank. This is a real, brief UI glitch.
- The test in `web/src/components/AppShell.test.tsx` ("falls back to My alerts when the active Admin tab disappears…", around lines 77–91) waits for the Admin tab to disappear, which also passes during that window, then reads `aria-selected` once without retrying.

**Required changes:**
1. **App:** in `web/src/components/AppShell.tsx`, while `me` is undefined (loading after a switch), don't render the Tabs panels with a stale value. Render the tab bar and a neutral "Loading…" panel, or keep the previous `me` visible. Choose the smallest change that leaves no blank panel and no selected-less state. The Admin fallback logic must still keep an admin→admin switch on the Admin tab (an existing test covers this).
2. **Test:** `await` the new user's data before asserting (e.g. `findByText` of the new home country), and wrap the `aria-selected` checks in `waitFor`. Apply the same to the second assertion block (around lines 90–91).
3. **Prove stability:** run `cd web && for i in $(seq 1 10); do npx vitest run 2>&1 | grep -E "Tests "; done` and quote all 10 lines. All must pass. Also run root `npm test` and `npm run build -w web` once.

Commit: `fix(web): no stale tab while user reloads; deflake tab fallback test`, with the trailer naming your model.
