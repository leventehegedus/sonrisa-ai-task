### Task 11a: Web scaffold, Tailwind, shadcn, root wiring, API connection

> **Split on 2026-10-19 (prompt 016, D-023).** The original Task 11 (below, kept for reference) is now three tasks: **11a** (this one, scaffold and API connection, no Redux), **11b** (Redux store, session slice, RTK Query `api.ts`, types; deferred), and **11c** (UserSwitcher and app shell; deferred). The user will revisit 11b and 11c.

**Files:**
- Create: `web/` from `npm create vite@latest web -- --template react-ts` (demo content removed), Tailwind 4 through `@tailwindcss/vite`, shadcn init (**Radix**) with **only** `button` and `card`, plus `web/src/App.tsx` showing the API connection status
- Modify: root `package.json` (workspaces `["server","web"]`, `dev` = `concurrently` running both, `test` runs both workspaces, `concurrently` devDependency), `web/vite.config.ts` (`/api` → `http://localhost:3000` proxy, `@` alias)

**Interfaces:**
- Produces: a working `web` workspace that later tasks add pages to. No state management yet.
- `App.tsx` does one plain `fetch('/api/me', { headers: { 'X-User-Id': '1' } })` and renders a shadcn Card: "Connected as Anna (HU, admin)" or the error text. Marked `// shortcut: plain fetch + hard-coded user 1 until RTK Query and the user switcher (Tasks 11b/11c)`.

- [ ] **Step 1:** Check the tooling first: record `npm view create-vite version` and `npx shadcn@latest init --help`, use non-interactive flags, and confirm by grep that `button` imports from `radix-ui` / `@radix-ui/*`.
- [ ] **Step 2:** Scaffold, Tailwind and shadcn as above. `npm run build -w web` exits 0.
- [ ] **Step 3:** Root wiring and the Vite proxy. `npm test` at the root still passes (server 214, web: none, or one trivial test if vitest is added).
- [ ] **Step 4: Real check.** Run `npm run dev` with a temp `DB_PATH`. `curl -s localhost:5173/api/me -H 'X-User-Id: 1'` returns Anna through the proxy, and `curl -s localhost:5173/` returns the app's HTML. Stop everything, delete `data/`, and confirm no listeners on 3000/5173. Paste the output into `docs/evidence/m3-web-connection.md`.
- [ ] **Step 5: Commit** `feat(web): vite + tailwind + shadcn scaffold with api proxy`

