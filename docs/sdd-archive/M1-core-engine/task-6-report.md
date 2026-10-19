# Task 6 report: channel adapters and registry
Built server/src/channels/{index,email,slack,message}.ts and server/test/channels.test.ts (14 tests).
- ChannelAdapter + createChannelRegistry + scrubSecrets in index.ts; buildMessage/AlertMessage in message.ts (uses CRITICAL_SEVERITY from weights.ts).
- email: nodemailer jsonTransport (or smtpUrl), outbox file `<ts>-<sanitized to>.json`, mkdir recursive; subject `[World Alerts] <title>`.
- slack: z.url({protocol:/^https$/}) + refine startsWith hooks.slack.com (R-P6 style); mask `https://hooks.slack.com/…/XXXX`; `Slack responded <status>`; dry-run logs.
## TDD
RED (stubs): 13 of 14 failed; e.g. scrubSecrets `AssertionError: expected 'failed https://hooks.slack.com/servic…' not to contain 'SECRET'`; others "Error: not implemented" (stubs throw, so those are not assertion failures; the scrub stub returned wrong value).
GREEN: 14/14. typecheck clean. Full server suite run before commit (see commit).
## Self-review
Hostile `a/../b@x.io` test accepts reject-or-sanitize and asserts nothing written outside outbox; direct `../../evil` is sanitized. Webhook never in error messages.
## Plan/spec defects: none. Concerns: none. RED for stubs mostly "not implemented" errors by design of stubbing throw.

## Fix round 1
1. Outbox name now `<ts>-<8 hex uuid>-<sanitized to>.json`, written with flag 'wx'; test: two back-to-back sends -> 2 files.
2. Tests: schema rejects `a/../b@x.io`; exact `sanitizeTo('../../../x/evil') === '.._.._.._x_evil'`; send with that `to` writes only inside outbox with exact name pattern. Mutation (sanitizer removed) -> 2 failures: `AssertionError: expected '../../../x/evil' to be '.._.._.._x_evil'`; restored.
3. Email adapter takes `log`; outbox mode logs `email (outbox) to=.. subject=.. file=..`; tested.
4. Slack fetch gets `signal: AbortSignal.timeout(10_000)`; tested.
5. Fetch rejections wrapped as `Slack request failed: <err.name>`; tested with URL-containing message.
Verification output:
- `npm run typecheck -w server` -> `> tsc --noEmit` (no errors)
- full suite -> `Test Files  7 passed (7)` / `Tests  101 passed (101)`
