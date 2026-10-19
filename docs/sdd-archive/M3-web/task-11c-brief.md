### Task 11c: User switcher and app shell

**Files:**
- Create: `web/src/components/UserSwitcher.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/AppShell.test.tsx`
- Add shadcn components: `select`, `tabs` (non-interactive CLI; confirm Radix imports by grep)
- Modify: `web/src/App.tsx` (render `AppShell`)

**Interfaces:**
- `UserSwitcher`: a shadcn `Select` listing `useGetUsersQuery()`; the selected value is `session.userId`; on change, `dispatch(switchUser(id))`. Marked `// shortcut: dev user switcher stands in for login`.
- `AppShell`: a header with "World Alerts", the current user (`useGetMeQuery`: name, home country, an "admin" badge text when `isAdmin`) and `UserSwitcher`; below it shadcn `Tabs` (**plain tabs, no router**, D-025): `My alerts`, `Channels`, `History`, plus `Admin` **only when `me.isAdmin`**. Each tab panel is a placeholder ("Coming in Task 12" / "Coming in Task 13").
- [ ] **Step 1: Failing tests:** render `AppShell` in a store with mocked `fetch` (`/api/me`, `/api/users`):
  - As admin (user 1), the Admin tab is visible.
  - As non-admin (user 2), the Admin tab is absent.
  - The switcher lists the 3 users.
- [ ] **Step 2:** Implement; tests green; `npm run build -w web` exits 0.
- [ ] **Step 3: Real check:** `npm run dev` with a temp `DB_PATH`, then `curl localhost:5173/api/users -H 'X-User-Id: 2'`. Stop everything, delete `data/`, no listeners left. Append to `docs/evidence/m3-web-connection.md`.
- [ ] **Step 4: Commit** `feat(web): user switcher and app shell with tabs`

