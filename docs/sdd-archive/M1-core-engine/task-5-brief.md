### Task 5: Ingest pipeline (events → deliveries)

**Files:**
- Create: `server/src/pipeline/ingest.ts`, `server/test/helpers.ts` (`makeDb()`, `addUser()`, `addChannel()`, `addRule()` test factories)
- Test: `server/test/ingest.test.ts`

**Interfaces:**
- Consumes: `openDb`, `evaluate`.
- Produces: `ingest(db: Database, events: NewEvent[], now: Date): { inserted: EventRow[]; deliveriesCreated: number }`. This is one transaction: `INSERT OR IGNORE` each event, and for **newly inserted** rows only, evaluate every enabled rule of every user. For each firing rule, for each channel ID in it that belongs to the rule's user and is enabled, do `INSERT OR IGNORE` into a delivery with `status 'pending'`, `attempts 0`, `next_attempt_at = now`, `score = importance` and `score_breakdown = JSON`.

- [ ] **Step 1: Write the failing tests:**
  - Ingesting a HU 0.5 news event for a HU user (rule threshold 0.5, 1 email channel) gives 1 delivery, `pending`, whose breakdown `proximityReason` is `'home'`.
  - Ingesting the same event again gives `inserted: []` and still 1 delivery.
  - The same user with two rules matching the same event on the same channel → 1 delivery.
  - A NP 0.5 event for a HU user → 0 deliveries.
  - A disabled channel → no delivery.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): ingest pipeline with dedup and scored deliveries`

