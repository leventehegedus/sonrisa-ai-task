### Task 11b: Redux store, session, RTK Query base, `/api/users`

> Added 2026-10-19 (prompt 020, D-025). Endpoints are added **per page**: 11b defines only `getMe` and `getUsers`; Tasks 12 and 13 add the endpoints their pages use.

**Files:**
- Create: `web/src/store.ts`, `web/src/session.ts`, `web/src/api.ts`, `web/src/types.ts`, `web/vitest.config.ts` (or a `test` block in vite.config), `web/src/api.test.ts`
- Modify: `web/src/main.tsx` (wrap in `<Provider store>`), `web/src/App.tsx` (replace the plain fetch with `useGetMeQuery`; remove its `shortcut:` comment), `web/package.json` (`test: vitest run`; dev deps `vitest@5 jsdom @testing-library/react`)
- Server: `server/src/http/user-routes.ts`: `GET /api/users` for any identified user, returning `[{ id, name }]` only (no email, no home country, no admin flag); a test in `server/test/api-user.test.ts`

**Interfaces:**
- `session.ts`: `sessionSlice` with `{ userId: number }` (default 1; localStorage key `wa.userId`, every read and write in try/catch), action `setUser(id)`, thunk `switchUser(id)` = `dispatch(setUser(id))` then `dispatch(api.util.resetApiState())`.
- `api.ts`: ONE `createApi({ reducerPath: 'api', baseQuery: fetchBaseQuery({ baseUrl: '/api', prepareHeaders: (h, { getState }) => h.set('X-User-Id', String(getState().session.userId)) }), tagTypes: ['Me','Users','Rules','Channels','MyDeliveries','AdminUsers','AdminRules','Events','Deliveries','Sources'], endpoints })`. Endpoints now: `getMe` (GET `/me`, provides `Me`) and `getUsers` (GET `/users`, provides `Users`). Export the hooks.
- `types.ts`: `Me`, `UserSummary { id; name }`, and `ApiError { error: string; issues?: unknown[] }`, marked `// shortcut: hand-copied API types, share them from the server if they drift`.
- `store.ts`: `configureStore` with `session` + `api.reducer` + `api.middleware`; exports `RootState`, `AppDispatch`, and typed `useAppDispatch` / `useAppSelector`.

- [ ] **Step 1: Failing tests (stubs first, R-P9):**
  - `api.test.ts`: with a fresh store and a mocked global `fetch`, `getMe` sends `X-User-Id: 1`. After `switchUser(2)`, a new `getMe` sends `X-User-Id: 2`, and the cached state from user 1 is gone (`api.util.resetApiState` ran).
  - Server: `GET /api/users` as non-admin user 2 → 200, with exactly the keys `id` and `name`.
- [ ] **Step 2:** Implement. `npm test` at the root runs both workspaces and is green; `npm run build -w web` exits 0.
- [ ] **Step 3: Commit** `feat(web): redux store, session slice, rtk query base; feat(api): GET /api/users`

