# Task 11: dispatch notes for the next session

**Resume from:** branch `feat/web`, HEAD after the prompt-014 commit. Everything up to M2 is merged and 214 tests pass.

1. Re-run `bash <superpowers>/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-19-world-alerts.md`. The ledger in `.superpowers/sdd/2026-10-19-world-alerts/progress.md` holds every ruling; a copy is in this folder.
2. Extract the brief (`task-brief … 11`) and dispatch an implementer (opus) with the controller clarifications below, then a task reviewer, following the SDD loop.

## Controller clarifications for Task 11 (binding)
- **Verify tooling, don't trust memory.** Run `npm view create-vite version` and `npx shadcn@latest init --help` and record them. Use non-interactive flags. **Radix is required:** confirm by grep that the components import from `radix-ui` / `@radix-ui/*`.
- Scaffold with `npm create vite@latest web -- --template react-ts`, then remove the demo content.
- Session: `sessionSlice { userId }` (default 1, localStorage `wa.userId` in try/catch); action `setUser`; thunk `switchUser(id)` = setUser + `api.util.resetApiState()`.
- One `createApi` with `fetchBaseQuery({ baseUrl: '/api' })`, and `prepareHeaders` setting `X-User-Id`. The tagTypes are as in the brief, with one endpoint per server route. **The channel PATCH sends `config` only when the user typed a new one** (the server rejects the masked value; M2 review R-018). Error bodies are `{ error, issues? }`; `issues` is optional.
- PATCH source uses `pollIntervalS` (D-020). Upper-case ISO2 country input.
- `web/src/types.ts` holds hand-copied API types, marked with a `// shortcut:` comment.
- `UserSwitcher`: a shadcn Select over `/api/admin/users`; on 403, fall back to ids 1–3.
- Vite: proxy `/api` → `http://localhost:3000`, `@` alias. Vitest uses jsdom.
- Root: workspaces `["server","web"]`; `dev` = `concurrently` running both; `concurrently` as a root devDependency.
- Real check: `npm run build -w web` exits 0, and `curl localhost:5173/api/me -H 'X-User-Id: 1'` reaches the API through the proxy. Use a temp `DB_PATH`, delete `data/` afterwards, and leave no listeners on 3000/5173.
- TDD: the `prepareHeaders` header test and the `switchUser` cache-reset test.

The interrupted attempt's partial work is in `interrupted-task-11-partial.patch` (and `git stash`, as "interrupted Task 11 partial work"). It's unreviewed; don't build on it.
