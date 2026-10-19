### Spec Compliance
- ✅ Spec compliant. All 9 admin routes from §11 and the brief are present, and no extra routes were added (`server/src/http/admin-routes.ts:329-368`). Every controller clarification is met:
  - Strict bodies: `SourcePatch` (`:296-299`) and `InjectBody` (`:300`).
  - PATCH accepts `poll_interval_s` 60..86400 and needs at least one field; an unknown id gets 404 (`:359`).
  - Retry runs only on a `failed` row: `pending`, attempts 0, `next_attempt_at` set to the current ISO time, `last_error` NULL. Anything else gets 409, and an unknown id gets 404 (`:319`, `:345-351`).
  - Poll ignores `enabled` and returns 200 with the `pollSource` result (`:364-368`).
  - Inject returns 201 `{event, deliveriesCreated}` through `ingest([manualEvent(body, now)], now)` (`:335-340`), which matches the §9 rule "same path, no demo shortcut".
  - `rowToSource` has the controller's shape (`rows.ts:273-276`).
  - `/admin/deliveries` uses the `/my/deliveries` mapper plus `userId`, and no channel config is selected into the output (`admin-routes.ts:303,311-317`).
  - Identity moved to `onRequest` (`app.ts:406`).
  - `main.ts` env handling matches the clarification: PORT, DB_PATH with mkdir, SMTP_URL, `SLACK_DRY_RUN` (anything other than `'0'` means dry run), SEED_SLACK_WEBHOOK, `data/outbox`, `127.0.0.1`, and shutdown on SIGINT/SIGTERM (`main.ts:496-525`).
  - The `package.json` scripts point at `src/main.ts`.
- ⚠️ Cannot verify from the diff:
  - The RED run is described as "2 passed … and one other" (report l.81). The second passing test isn't named. It is almost certainly `PATCH unknown id → 404`, which passes against the stub with no routes because the not-found handler also returns 404 `{error:'not found'}`. That is a small gap in the evidence, not a defect.
  - HEAD behaviour on the admin GET routes is reasoned below, not tested.

**Named-risk checks**
1. **Admin enforcement and identity coverage. OK.**
   - `requireAdmin` is an `onRequest` hook inside the admin plugin's encapsulated context (`admin-routes.ts:327`), so it applies to every route in that plugin.
   - `authenticate` is on the parent `/api` context (`app.ts:406`). Parent hooks run first, so `req.user` is always set before `requireAdmin` reads it.
   - Fastify hooks attach per route by encapsulation context, not by URL-prefix string matching. So `/apix…` and `/api/admin/users/` (trailing slashes are not ignored by default) match no route and fall through to the root 404 handler without touching data.
   - The HEAD routes Fastify adds for GET routes are registered in the same context, so they carry the same hooks. No OPTIONS/CORS routes exist.
   - The test checks all 9 routes for 403 and checks that nothing was fetched or written (`api-admin.test.ts:576-583`).
2. **Retry race. OK.** The retry is a single conditional `UPDATE … WHERE id = ? AND status = 'failed'` (`admin-routes.ts:319`). The 409/404 lookup runs only when `changes === 0`. The dispatcher only holds rows it selected as `pending`, and only the dispatcher moves a row to `failed`, so a retry can't reset a row the dispatcher is working on. Tests cover `sent` and `pending` → 409 with the row unchanged (`test:681-688`).
3. **Smoke evidence. It looks real and consistent with the code.**
   - The scheduler starts before `listen`, so the first tick polls from about 40.5 s, and the sources were polled one after another at 41.68 → 42.25. `baselineAt` equals `lastPolledAt`, which matches the first-success baseline rule in `poll.ts`.
   - The ticks then fall at about 50.5 and 00.5. That fits `sentAt 18:42:00.898` for the event injected at 55.248.
   - The outbox filename epoch `1792435320912` decodes to `2026-10-19T18:42:00.912Z`, which matches the log line.
   - Delivery ids, channels and rules are 1/1/1 (Anna) and 2/2/2 (Bence). Without `SEED_SLACK_WEBHOOK`, Bence has no Slack channel, so the count of 2 is correct. The order (id 2 then id 1) follows `created_at DESC, id DESC`.
   - Event id 363 follows 362 baseline rows.
   - The `127.0.0.1` in the log line comes from `main.ts:515-516`. The Slack dry-run default isn't exercised, because no Slack channel was seeded, and the evidence doesn't claim it was.
4. **Shutdown during an in-flight tick. No crash.**
   - `scheduler.stop()` only clears the interval. A running tick can resume while `await app.close()` is pending, but the DB is still open at that point.
   - `db.close()` and `process.exit(0)` run back to back with no `await` between them (`main.ts:521-522`), so no tick continuation can run against a closed DB.
   - Real effect: if a send completes but `markSent` hasn't run yet, the delivery stays `pending` and is sent again on restart. That is the at-least-once behaviour already documented in `dispatch.ts`. A poll in flight is simply abandoned, and `ingest` is transactional, so no partial rows are written. Minor at most (see below).

### Strengths
- The retry is race-free by design: one conditional UPDATE, with the lookup only for choosing the error code. The report's claim about this is accurate.
- Admin gating relies on Fastify encapsulation rather than on remembering to add it to each route. The 403 test also checks that nothing was written or fetched, which is stronger than checking the status code alone.
- Moving auth to `onRequest` correctly gives 401 before body parsing, and both sides are tested (401 for an unknown caller, 400 for a known one, `test:584-591`).
- Good reuse without new abstraction: `DELIVERY_EVENT_COLUMNS` and `rowToSource` in `rows.ts` (R-P5), and `IdParams` and `notFound` exported rather than copied.
- The secret-leak test seeds a real-looking webhook and asserts that neither the secret nor `hooks.slack.com` appears in `/admin/deliveries` (`test:649-664`).
- The poll test proves that a disabled source is still polled, and it checks `lastPolledAt` and `baselineAt` through the API.
- The `127.0.0.1` bind has a correctly formatted `shortcut:` comment that gives the reason.
- The smoke evidence is honest and internally consistent.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. `server/src/main.ts:518-525`: the shutdown path has no error handling. If `app.close()` rejects, `shutdown` becomes an unhandled rejection: the process exits 1 and `db.close()` is skipped. SQLite/WAL recovers from that, so the real effect is only a noisy exit. Also, a send that finished during shutdown but wasn't recorded is sent again on restart (already covered by the `dispatch.ts` at-least-once `shortcut:`). A `try/finally` around `app.close()` would be enough.
2. `server/src/main.ts:512-515`: the scheduler starts, and begins polling real feeds, before `listen`. If `listen` fails (for example `EADDRINUSE`, or a non-numeric `PORT`, which the report acknowledges), the top-level await rejects and the process dies mid-tick. That is harmless but untidy. Starting the scheduler after `listen` is a one-line reorder.
3. `server/test/api-admin.test.ts:689-691,718-720,735`: the "unknown id → 404" tests can't tell the handler's 404 from the not-found handler's 404 for a missing route, because both return `{error:'not found'}`. That is why one of them passed in RED. Asserting a 200 for a known id in the same test, or using a distinct body, would make these tests meaningful.
4. `server/src/http/admin-routes.ts:364-368`: a manual `POST /sources/:id/poll` can run at the same time as a scheduler poll of the same source, since both `await` the fetch. `INSERT OR IGNORE` and the `COALESCE(baseline_at, …)` update make this harmless (no duplicate events or deliveries). This is noted only for awareness, and no change is needed.
5. Report l.81: the second test that passed during RED isn't named, which leaves a small gap in the TDD evidence.

### Assessment
**Task quality:** Approved
**Reasoning:** Every route, controller clarification and named risk checks out against the code: the admin gating is airtight, the retry is atomic, the smoke evidence is consistent, and shutdown can't close the DB under a running dispatch. The remaining items are small robustness and test-precision improvements.
