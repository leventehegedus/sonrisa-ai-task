# Task 1 report

Status: DONE

## Implemented
Root workspace (workspaces=["server"], scripts test/typecheck/dev), server package (ESM, scripts test/typecheck/dev), tsconfig per R-P1, vitest config, `types.ts` verbatim from brief, `schema.sql` (6 tables, FKs per brief, deliveries.next_attempt_at, CHECK constraints on enums), `openDb` (foreign_keys ON, WAL unless :memory:), .gitignore.

## Tests
`npm test -w server`: 5 passed. `npm run typecheck -w server`: clean.

## TDD
RED: `npm test` in server -> `FAIL test/db.test.ts: Cannot find module '../src/db'` (expected, openDb didn't exist).
GREEN: `Test Files 1 passed, Tests 5 passed`.

## Versions
fastify 5.12.7, better-sqlite3 13.0.3, zod 4.6.7, fast-xml-parser 5.11.2, nodemailer 10.1.7, vitest 5.0.5, tsx 4.23.15, typescript 7.0.2 (`tsc --version` -> Version 7.0.2), @types/better-sqlite3 9.6.0, @types/nodemailer 8.0.2, @types/node 26.6.5.
R-P3 fallback NOT used: TS 7.0.2 typechecks fine. better-sqlite3 13 loads on Node v24.13.1.

## Files
package.json, package-lock.json, .gitignore, server/{package.json,tsconfig.json,vitest.config.ts}, server/src/types.ts, server/src/db/{schema.sql,index.ts}, server/test/db.test.ts

## Self-review
- tsconfig also sets target ES2023, skipLibCheck, esModuleInterop, types:["node"] (needed for typecheck, harmless).
- Added CHECK constraints for enum columns and `deliveries.event_id ON DELETE CASCADE` (not specified; sensible for events) and rule_id nullable per SET NULL.
- server `dev` script points at src/index.ts, which does not exist yet (later task).

## Plan/spec defects
- Brief says "PASS, 4 tests" but lists 5 test bullets; I wrote 5.
- Because channel_id is nullable, UNIQUE(event_id, channel_id) does not dedupe rows with NULL channel_id (SQLite treats NULLs as distinct). Fine for audit rows, but note for dispatcher.
- Brief's `npx -w server tsc` form isn't needed; `npx tsc` in server/ works.

## Concerns
None.
