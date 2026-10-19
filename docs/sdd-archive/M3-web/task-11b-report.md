# Task 11b report

Status: DONE (see concerns)

## Built
- server/src/http/user-routes.ts: `GET /api/users` -> `[{id,name}]` ordered by id (prepared stmt `q.users`).
- web/src/{types,session,api,store}.ts, api.test.ts, vitest.config.ts (merges vite config, jsdom), main.tsx (Provider), App.tsx (useGetMeQuery, Retry -> refetch, `API not reachable: HTTP <status>` or message).
- web/package.json: `test: vitest run`; deps @reduxjs/toolkit 2.13.0, react-redux 9.3.0; dev vitest 5, jsdom, @testing-library/react.

## TDD
- Server RED: `AssertionError: expected 404 to be 200` (users test). GREEN after route.
- Web RED (switchUser with resetApiState line commented out): `AssertionError: expected { Object (id, name, ...) } to be undefined`. GREEN after restoring.
- Test asserts `request.headers.get('X-User-Id')` from the mocked fetch Request: '1', then '2' after switchUser(2).

## Verification
- root `npm test`: server 13 files / 215 tests passed; web 1 file / 1 test passed.
- `npm run typecheck -w server`: clean. `npm run build -w web`: built OK.

## Concerns / defects
- fetchBaseQuery builds a `Request`, which rejects a relative baseUrl outside browsers (Node/jsdom: "Failed to parse URL from /api/me"). So baseUrl is `${location.origin}/api` (same origin in the browser, so the Vite proxy still applies). Brief said `/api`.
- No real server check run. A pre-existing process listens on :3000 and repo-root `data/alerts.db` exists; neither was created by me, both left untouched.
- @testing-library/react installed but unused (per brief).
