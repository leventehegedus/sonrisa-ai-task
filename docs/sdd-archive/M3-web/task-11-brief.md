### Task 11: Web scaffold, store, user switcher

**Files:**
- Create: `web/` from `npm create vite@latest web -- --template react-ts`, then Tailwind 4 through `@tailwindcss/vite`, then `npx shadcn@latest init` (pick **Radix** as the primitive library and the default style). Add components: `button card input label select slider switch table tabs dialog badge checkbox sonner`.
- Create: `web/src/store.ts`, `web/src/session.ts`, `web/src/api.ts`, `web/src/components/UserSwitcher.tsx`
- Modify: `web/vite.config.ts` (`server.proxy['/api'] = 'http://localhost:3000'`, `@` alias as shadcn requires)
- Test: `web/src/api.test.ts` (vitest; dev deps `vitest@5 jsdom @testing-library/react`, `environment: 'jsdom'`)

**Interfaces:**
- `session.ts`: `sessionSlice` with `{ userId: number }` (default `1`, persisted to `localStorage` inside try/catch) and the action `setUser(id)`.
- `api.ts`: a single `createApi`, with `baseQuery = fetchBaseQuery({ baseUrl: '/api', prepareHeaders: (h, { getState }) => h.set('X-User-Id', String(getState().session.userId)) })`.
  - tagTypes `['Me','Rules','Channels','MyDeliveries','Users','AdminRules','Events','Deliveries','Sources']`.
  - One endpoint per route in Tasks 9–10, with hooks exported (`useGetMeQuery`, `useCreateRuleMutation`, …). Mutations invalidate the matching tags. `injectEvent` invalidates `Events`, `Deliveries` and `MyDeliveries`.
  - **Switching user must reset the cache:** dispatch `api.util.resetApiState()` in the `setUser` thunk.
- `UserSwitcher`: a shadcn `Select` listing `/api/admin/users`. It falls back to IDs 1–3 if that returns 403 (non-admin). `// shortcut: dev user switcher stands in for login`.

- [ ] **Step 1: Write the failing test:** `prepareHeaders` sets `X-User-Id` from the state. Use a configured store and a mocked `fetch`, and assert the request header equals `'2'` after `setUser(2)`.
- [ ] **Step 2–4:** Fail → implement → pass. Also run `npm run build -w web`; expected exit 0.
- [ ] **Step 5: Commit** `feat(web): vite+tailwind+shadcn scaffold, rtk query api, user switcher`

