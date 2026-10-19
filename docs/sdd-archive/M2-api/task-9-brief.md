### Task 9: HTTP app, user routes, seed

**Files:**
- Create: `server/src/http/app.ts`, `server/src/http/auth.ts`, `server/src/http/user-routes.ts`, `server/src/db/seed.ts`
- Test: `server/test/api-user.test.ts`

**Interfaces:**
- Produces: `buildApp(db: Database, deps: { registry; fetchImpl; now: () => Date; log }): FastifyInstance` (no `listen`; tests use `app.inject`).
- `auth.ts`: a preHandler reads `X-User-Id`, loads the user, and sets `req.user`. Missing or unknown → `401`. `requireAdmin` → `403` for non-admins. Mark it `// shortcut: header identity, not authentication; replace with real auth before any deployment`.
- Routes: as in design §11 (user part). Rule body zod: `name` 1..100, `categories` ⊆ enum, `keywords` max 20 strings of 1..50 chars, `threshold` 0..1, `channelIds` that must all belong to `req.user` (else `400`), `enabled`. Channel bodies are validated by `registry[type].configSchema`, and responses use `maskConfig`.
  - `DELETE /api/channels/:id` removes the ID from the user's rules' `channelIds` in the same transaction.
  - `POST /api/channels/:id/test` sends `buildMessage` of a synthetic event straight away and returns `{ ok, error? }`.
  - `GET /api/my/deliveries` joins `events` and parses `score_breakdown`.
- `seed(db)` is idempotent and only runs when `users` is empty. It creates:
  - users: `Anna (HU, admin)`, `Bence (HU)`, `Priya (NP)`
  - one email channel each, and Bence also gets a slack channel only if the `SEED_SLACK_WEBHOOK` env var is set
  - one default rule per user (all categories, threshold 0.5)
  - sources: gdacs, coingecko, rss telex (HU), rss hvg (HU), rss bbc-world (global), each with `poll_interval_s 300`

- [ ] **Step 1: Write the failing tests:**
  - No header → 401.
  - Rule CRUD round-trip.
  - **Review Focus 5:** threshold `1.5` → 400; category `sports` → 400; a `channelIds` entry of another user → 400; a slack `http://` webhook → 400. In each case the table row count is unchanged.
  - **Review Focus 2:** `GET /api/channels` after creating a slack channel doesn't contain the secret part.
  - **Review Focus 3:** deleting a channel removes it from the rule's `channelIds`.
  - The seed run twice still gives 3 users.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(api): fastify app, header identity, user routes, seed`

