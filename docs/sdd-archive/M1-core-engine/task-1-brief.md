### Task 1: Workspace scaffold, domain types, database

**Files:**
- Create: `package.json`, `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/types.ts`, `server/src/db/schema.sql`, `server/src/db/index.ts`, `.gitignore` (add `node_modules`, `data/`, `web/dist`, `test-results/`)
- Test: `server/test/db.test.ts`

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type Category = 'news' | 'market' | 'disaster';
  export type Scope = 'country' | 'global' | 'unknown';
  export interface NewEvent { source: string; externalId: string; category: Category; title: string; summary: string | null; url: string | null; scope: Scope; country: string | null; severity: number; occurredAt: string; raw: unknown }
  export interface EventRow extends NewEvent { id: number }
  export interface User { id: number; name: string; email: string; homeCountry: string; isAdmin: boolean }
  export interface Rule { id: number; userId: number; name: string; categories: Category[]; keywords: string[]; threshold: number; channelIds: number[]; enabled: boolean }
  export type ProximityReason = 'home' | 'subregion' | 'continent' | 'elsewhere' | 'global' | 'unknown';
  export interface ScoreBreakdown { severity: number; proximity: number; proximityReason: ProximityReason; override: boolean; importance: number; threshold: number; fires: boolean }
  export type DeliveryStatus = 'pending' | 'sent' | 'failed';
  ```
- Produces: `openDb(path: string): Database.Database`. Runs `schema.sql` (`CREATE TABLE IF NOT EXISTS …`) and sets `PRAGMA foreign_keys = ON` and `journal_mode = WAL` (WAL is skipped for `:memory:`).
- Tables, per design §6: `users`, `channels`, `rules`, `events` (`UNIQUE(source, external_id)`), `deliveries` (`UNIQUE(event_id, channel_id)`, plus `next_attempt_at TEXT`), `sources`. JSON columns are stored as TEXT.
- Foreign keys: channels and rules → users `ON DELETE CASCADE`. **deliveries.channel_id and deliveries.rule_id → `ON DELETE SET NULL`**, so delivery history survives as an audit trail, and the dispatcher can mark orphans as failed.

- [ ] **Step 1:** Root `package.json`: `"workspaces": ["server","web"]`, scripts `test: npm test -w server -w web --if-present`, `dev: concurrently -n server,web "npm run dev -w server" "npm run dev -w web"`. Install server deps: `fastify@5 better-sqlite3@13 zod@4 fast-xml-parser@5 nodemailer@10`, dev: `typescript tsx vitest@5 @types/better-sqlite3 @types/nodemailer @types/node`. Verify: `npx -w server tsc --version` and `node -e "require('better-sqlite3')(':memory:')"` (run in `server/`) exit 0. If better-sqlite3 has no Node 24 prebuild, log it and stop.
- [ ] **Step 2: Write the failing test** `server/test/db.test.ts`:
  - `openDb(':memory:')` creates all 6 tables (query `sqlite_master`).
  - Inserting two events with the same `(source, external_id)` using `INSERT OR IGNORE` leaves 1 row.
  - Inserting two deliveries with the same `(event_id, channel_id)` leaves 1 row.
  - Deleting a user cascades to their channels and rules (`ON DELETE CASCADE`).
  - Deleting a channel keeps its delivery row, with `channel_id` set to NULL.
- [ ] **Step 3:** Run `npm test -w server`. Expected: FAIL (`openDb` is not defined).
- [ ] **Step 4:** Implement `types.ts`, `schema.sql` and `db/index.ts` (read `schema.sql` with `fs.readFileSync(new URL('./schema.sql', import.meta.url))`).
- [ ] **Step 5:** Run `npm test -w server`. Expected: PASS, 4 tests.
- [ ] **Step 6: Commit** `feat(server): scaffold workspace, domain types, sqlite schema`

