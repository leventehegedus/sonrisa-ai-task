### Finding Verdicts
- I-1 ADDRESSED. server/src/channels/slack.ts:7-9 requires prefix https://hooks.slack.com/services/ and rejects any value containing the ellipsis character. Tests: server/test/channels.test.ts (masked form, /foo path, /services/T0/…/1234 rejected); server/test/api-user.test.ts (GET -> PATCH same config -> 400, DB config compared to the original SECRET_HOOK JSON).
- M-1 ADDRESSED. server/src/http/admin-routes.ts:15-17 (strict, 60..86400, at least one field) and :77. Tests updated in server/test/api-admin.test.ts.
- M-2 ADDRESSED. server/src/main.ts:29,31: startScheduler is called after `await app.listen`.
- M-6 ADDRESSED. server/src/http/user-routes.ts:56: accurate shortcut comment at the LIMIT 100 query.
- M-9 ADDRESSED. server/src/main.ts:11-12,22. From server/src/main.ts, '../../data/' resolves to <repo>/data/ (verified: file:///r/server/src/main.ts -> /r/data/). Explicit DB_PATH still wins. The outbox uses the same dataDir.

### New Breakage in the Fix Diff
None found. A real Slack URL with a query string still passes (startsWith plus no ellipsis). The outbox is only configured in main.ts, so no divergence (email.ts creates it with mkdirSync recursive). data/ is gitignored. Vitest run: 3 files, 91 tests passed.

### Out-of-Scope Observations
- Masked-GET -> PATCH now returns 400 instead of overwriting, but the client has no way to say "keep existing config"; the UI must omit config on PATCH.
- main.ts default path is only cwd-independent when run from source (tsx), not from a bundled build.

### Verdict
Ready to merge? Yes
