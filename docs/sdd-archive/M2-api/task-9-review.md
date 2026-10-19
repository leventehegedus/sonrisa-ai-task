### Spec Compliance
- ✅ Spec compliant. Brief, §11 user routes, Review Focus 2/3/5 (Task 9 parts) and all controller clarifications are met:
  - one error handler: `app.ts:123-130`
  - strict positive-int X-User-Id: `auth.ts:155-166`
  - registry-key type check via `Object.hasOwn`: `user-routes.ts:290`
  - config validated by `configSchema`: `user-routes.ts:243-246`
  - email `to` default: `user-routes.ts:244`
  - PATCH can't change type (strict schema): `user-routes.ts:209`
  - masked responses: `user-routes.ts:241`
  - channelIds deduped and owned: `user-routes.ts:257-258, 269-270`
  - foreign rows → 404: `user-routes.ts:219, 225`
  - transactional channel delete: `user-routes.ts:308-312`
  - direct test send, also on disabled channels: `user-routes.ts:321-339`
  - deliveries newest first, limit 100: `user-routes.ts:229-235`
  - seed: 3 users, 5 sources at 300 s, configs parsed by the adapter schemas, email channel per user, Slack for Bence via `opts.slackWebhook`: `seed.ts:81-97`
  - R-P5 mappers live in `rows.ts`.
- Accepted deviations (already ruled): seed takes `opts.slackWebhook` instead of reading the env var; the extra `GET /rules/:id` and `GET /channels/:id` routes; the implementer's breaking-keyword lists.
- Empty `categories` means "all categories". I checked this against `matching/index.ts:10` (`rule.categories.length && …`), so seed's `'[]'` meets "all categories".
- The Review Focus 3 hand-off holds. Delete sets `channel_id` to NULL (tested, `api-user.test.ts:545`), and the dispatcher fails those rows with `'channel deleted'` (`pipeline/dispatch.ts:25`, checked outside the diff for this exact risk).
- ⚠️ Cannot verify from diff:
  - typecheck and full-suite results (from the report only; not re-run)
  - "documented item shape" for `/my/deliveries`: the shape exists only as code (`rows.ts:51-56`) and a test (`api-user.test.ts:589-593`). No API doc was touched.

### Strengths
- **IDOR is closed for every `:id` route.** Reads, rule delete and the existence checks for PATCH, channel delete and test-send all go through `WHERE id = ? AND user_id = ?`. One test covers a foreign channel on GET, PATCH, DELETE and /test (`api-user.test.ts:525-530`) and another covers foreign rules (`:432-439`).
- **No mass assignment.** `z.strictObject` on every body means `userId`, `id` and `type` are rejected rather than stripped. The `{...cur, ...b}` spread at `user-routes.ts:269` only carries validated `ruleFields`.
- **Every success response is masked.** Create, list, get and patch all go through `masked()`. Test-send errors go through `scrubSecrets`. zod 4 issues don't echo input, and the 400 tests assert there is no `SECRET` (`api-user.test.ts:514`).
- **The error handler handles both cases asked about.**
  - A nested `configSchema.parse` throws `ZodError`, which becomes 400. The slack `http://` and bad-email cases prove it through the real route path.
  - A non-zod error is logged with pattern scrubbing (Slack paths, `user:pass@`) and the client gets only `{error:'internal error'}`. Fastify runs without its logger, so no stack is printed. The test is `api-user.test.ts:565-573`, and a mutation check confirmed it.
- **Validation runs before any write.** "Nothing written" is asserted with row counts or row contents for each Review Focus 5 case, on both POST and PATCH.
- **Tests use real adapters** (real registry, stubbed fetch, tmp outbox). The deliveries test would catch cross-user leakage, since Anna's rows would double the list.
- **R-P9 RED evidence shows real assertion failures**, not "module not found".

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Implementer concern (1): auth runs as `preHandler`, so the body is parsed before identity is checked** (`app.ts:134`). **Severity: Minor.**
   - An unauthenticated client gets a 400 on malformed JSON instead of a 401, and can make the server parse up to 1 MB.
   - No handler runs, so no data is exposed.
   - `authenticate` reads only a header, so moving it to `onRequest` is a one-word change that keeps the brief's intent. Recommend doing it, together with a test: no header plus a malformed body → 401.
2. **Implementer concern (2): seed stores `slackWebhook` without validating it** (`seed.ts:92-93`). **Severity: Minor.**
   - A bad value fails safely: test-send returns `invalid channel config`, and maskConfig still shows only the last 4 characters.
   - It could be validated with the Slack schema in seed (importing it directly, as is already done for `sourceAdapters`), or in main.ts in Task 10.
3. **Implementer concern (5): `/my/deliveries` reaches history through the channel OR the rule** (`user-routes.ts:233`). Once both are deleted (both FKs are SET NULL), the user loses that history. **Severity: Minor.**
   - This is acceptable for the demo.
   - Add `// shortcut: history found via channel/rule ownership, add deliveries.user_id if history must survive deletes` next to the query.
4. **Ownership is not in the write SQL itself.** `updateRule`, `updateChannel` and `deleteChannel` (`user-routes.ts:221, 227, 228`) use `WHERE id = ?` only and rely on the ownership SELECT just before them.
   - This is not exploitable today: better-sqlite3 is synchronous and there is no `await` between the check and the write.
   - Still, `AND user_id = ?` costs nothing and makes each statement safe on its own, which the named risk asked for.
   - The channel delete also does its ownership check outside the transaction (`:315` vs `:308`).
5. **The 4xx passthrough is keyed on `statusCode` alone** (`app.ts:127`). Any thrown error that carries a 4xx `statusCode` would have its raw `message` returned unscrubbed. Today only Fastify's own `FST_*` errors reach it.
   - Fix: gate on `e.code?.startsWith('FST_')`, or pass the message through `scrub`.
   - Related (implementer concern 4): malformed-JSON 400s return `{error, code}` without `issues`, so they don't fully match the global `{ error, issues }` shape. Low impact.
6. **The test-send error only removes this channel's config values** (`user-routes.ts:337`, `scrubSecrets(msg, c.config)`). An email transport error that included `SMTP_URL` credentials would not be scrubbed.
   - This matches the dispatcher's existing behavior (`dispatch.ts:41`), and nodemailer rarely echoes passwords.
   - Applying `app.ts`'s pattern `scrub` here as well would be cheap. That means exporting it, and DRY-ing it with the dispatcher.
7. **Test gaps:**
   - No test checks that test-send scrubs a thrown error that contains the webhook. `'Slack responded 500'` never contains the secret, so the scrub path isn't exercised at the route level.
   - The GET-by-id masked response isn't asserted secret-free. It shares `masked()` with the other responses, so the risk is low.
8. **`masked()` uses `registry[c.type]?.maskConfig(...)`** (`user-routes.ts:241`) where the other lookups use `Object.hasOwn`. It is unreachable, because the type is validated on insert, but it is inconsistent.
9. **`/my/deliveries` is hard-capped at `LIMIT 100` with no `shortcut:` comment** noting there is no pagination.

### Assessment
**Task quality:** Approved
**Reasoning:** The four named risks all check out: IDOR, mass assignment, secret masking, and the error handler's zod→400 and scrubbed 500. Each Review Focus item is tested with "nothing written" assertions. What remains is defense-in-depth and polish. The `onRequest` auth move and the `AND user_id` in the write SQL are worth folding in cheaply.
