# Task 11c report
Built: web/src/components/{UserSwitcher,AppShell}.tsx, AppShell.test.tsx; shadcn select, tabs, badge (all import from `radix-ui`, grep-confirmed); App.tsx now renders AppShell (connection Card removed; error + Retry live in the shell header: "API not reachable: ..."); vite proxy target `process.env.API_TARGET ?? 'http://localhost:3000'`.
Typing fix: switchUser thunk extra-arg type `unknown` -> `undefined` (session.ts); `as never` cast removed from api.test.ts; `tsc -b` passes.
Tests (switcher approach): real Radix Select opened in jsdom with 3 polyfills (hasPointerCapture, releasePointerCapture, scrollIntoView) + fireEvent.pointerDown; asserts the 3 options from /api/users, then clicks Bela and asserts Admin tab disappears and home country updates (exercises switchUser + refetch end to end).
RED (stubs returning null): 3 failed | 1 passed, "Unable to find role=tab and name Admin" / "History".
GREEN: web Tests 4 passed (4). Root `npm test`: 13 files, 215 tests passed. `npm run build -w web`: built OK. Lint: only warnings on shadcn files.
Real check: appended to docs/evidence/m3-web-connection.md (ports 3001/5174, temp DB, only own PIDs killed, no listeners left; user's :3000 and data/ untouched, so data/ not deleted).
Defects: brief says "Coming in Task 12 / 13" per tab; I used Task 12 for My alerts/Channels/History, Task 13 for Admin. Badge component was needed too (added via shadcn).

## Fix round 1
- Tabs now controlled (`useState`, `active` falls back to 'alerts' if the stored tab isn't visible); SelectValue has `placeholder="Select user"`.
- New test "falls back to My alerts when the active Admin tab disappears..." RED: `expected 'false' to be 'true'` (aria-selected); GREEN after fix.
- Web: Tests 5 passed (5). Root `npm test`: server 13 files/215 tests passed, web 2 files/5 tests passed. `npm run build -w web`: built OK.
