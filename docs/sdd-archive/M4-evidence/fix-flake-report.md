# Fix report: AppShell tab flake

Commit: see `git log -1` on fix/appshell-tab-flake ("fix(web): no stale tab while user reloads; deflake tab fallback test").

## Built
- web/src/components/AppShell.tsx: while `me` is undefined, render `<p>Loading…</p>` instead of Tabs (no selected-less blank panel). Fallback logic unchanged, so admin->admin still keeps Admin (existing test passes). Prettier reindented the Tabs block.
- web/src/components/AppShell.test.tsx: fallback test now awaits new user's data (`findByText(/DE/)`) and wraps both aria-selected checks in `waitFor`.

## RED (before fix, 5 runs of `npx vitest run`)
Tests 1 failed | 23 passed (24) (x2, the fallback test); 24 passed x3.

## GREEN (10 runs)
10 x `Tests  24 passed (24)`.

## Other
- root `npm test`: server 215 passed (13 files), web 24 passed (5 files).
- `npm run build -w web`: built OK.

## Concerns
Whole tab bar is hidden during first load/error too (shows "Loading…"), a small visible change. Plan defects: none.

## Fix round 1
- AppShell.tsx: `{me ? <Tabs/> : <p>{error ? 'Could not load your session.' : 'Loading…'}</p>}`. Formatting restored to codebase style (single quotes, no semis, width 140); diff vs ad51de4 is 17+/12-, the remainder is the unavoidable reindent of the Tabs block.
- New test: /me returns 500 -> "Could not load your session." shown, no "Loading…".
- 10x vitest loop: 10 x `Tests  25 passed (25)`. Root `npm test`: server 215 passed, web 25 passed. `npm run build -w web`: built.
