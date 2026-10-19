### Spec Compliance
- ✅ Spec compliant, with one justified deviation (baseUrl, see Minor 1).
- ⚠️ Cannot verify from diff: `npm test` / `build` results (taken from the report only); no real-server run (report admits it).

### Strengths
- /api/users is a prepared `SELECT id, name ... ORDER BY id` (user-routes.ts:+/-), so nothing else can leak. It sits under the `/api` plugin with the `onRequest` authenticate hook (app.ts:32), so it is 401 without a valid header like every other route.
- Server test uses `toEqual` on the exact `[{id,name}]` list, so extra keys would fail it. The header is read from the Request the mocked fetch received, as agreed.
- TDD RED shows real assertion failures. App is simplified and the old `shortcut:` comment is removed. No api<->session import cycle (api.ts only uses a type cast for state).

### Named risks
1. baseUrl: `${location.origin}/api` is evaluated once at module load. In the browser (Vite dev, same origin, proxy applies) this equals the relative `/api`, so no breakage. A production build served from the same origin as the API is fine; a split-origin deployment would need a configurable base anyway, which today's relative `/api` would not support either. The suggested jsdom-url fix would NOT work: fetchBaseQuery does `new Request(url)`, which is Node's undici Request and does not resolve against jsdom's location. The realistic alternatives are `fetchFn` wrapping or a test-only base. The current fix is acceptable. It does make api.ts throw if imported where `location` is undefined (node env/SSR); fine now.
2. switchUser order is correct in effect. setUser is synchronous, so any request started afterwards reads the new header. A request in flight for the old user resolves after resetApiState; RTK's reducer uses `updateQuerySubstateIfExists` (buildSlice.ts:234) and the entry is gone, so the stale result is dropped and cannot repopulate the cache. Mounted hooks resubscribe and refetch under the new user. The test covers the cache-drop but not the in-flight race (Minor 3).
3. localStorage: read is in try/catch; write is in try/catch. Invalid values: "abc" -> NaN, "-1" -> -1, "" / null -> 0, "1.5" all fall back to 1. Verified by reading `load()`, but not covered by any test (Minor 2). Side effect inside a reducer (session.ts setUser) is impure; acceptable but non-idiomatic.
4. /api/users returns only id and name; 401 without the header is enforced by the shared hook (not asserted by a /users-specific test; covered for /me at api-user.test.ts:40-45).

### Issues
#### Critical (Must Fix)
None.
#### Important (Should Fix)
None.
#### Minor (Nice to Have)
1. web/src/api.ts:7 baseUrl deviates from the brief's `/api`; justified, and the comment explains it. The deviation should be noted in the plan/log.
2. web/src/session.ts:8-14, 22-27: the localStorage fallback behaviour (invalid value, throwing storage) has no test, though the brief calls it out. A small test with `localStorage.setItem('wa.userId','abc')` plus a re-import would cover it.
3. web/src/api.test.ts:23: `switchUser(2) as never` hides a thunk typing gap (the thunk is typed with `unknown` state and the store's dispatch rejects it). Type the thunk with `RootState`/`AppDispatch` or use `ThunkDispatch` so callers need no cast. `getUsers` has no test.
4. session.ts: `load()` accepts any positive integer (e.g. 999); the server 401s it and the user sees "HTTP 401" until the switcher (11c) exists. Acceptable for now.

### Assessment
**Task quality:** Approved
**Reasoning:** The server endpoint is minimal, authenticated and leak-free, and the store, session and API wiring behave correctly in effect, including the stale-request race. Only test-coverage and typing polish remain.
