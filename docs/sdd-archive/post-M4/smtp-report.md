# SMTP config report
Status: DONE.
Built: server/src/channels/email.ts (`from` option, default unchanged), channels/index.ts (threaded `from`), server/src/main.ts (`.env` via process.loadEnvFile resolved from import.meta.url, only if present; SMTP_FROM; PORT/DB_PATH now use `||` so empty values in a copied .env fall back to defaults), .gitignore, .env.example, README (env row, .env note, "Real email (Gmail)"), docs/evidence/smtp-ethereal-check.md.
loadEnvFile verified: does NOT override existing env vars (A_TEST=real kept, B_TEST taken from file).
Tests: two added in server/test/channels.test.ts. RED: `expected '{"from":{"address":"alerts@world-aler…' to contain 'ops@test.local'` (1 failed, 22 passed). GREEN after impl: root `npm test` server 13 files / 217 tests passed, web 5 files / 25 passed. `npm run typecheck -w server` clean.
Real check: Ethereal send via API returned {"ok":true}; preview URL in evidence file. :3003 freed; user's :3000/:5173 still listening, data/ untouched.
Concerns: Gmail rewrites From (documented). No test of the .env loading in main.ts (top-level script); checked by hand only.

## Fix round 1
email.ts: `opts.smtpUrl || { jsonTransport: true }` so empty smtpUrl matches the outbox branch. Test added in channels.test.ts.
RED: `TypeError: Cannot create property 'mailer' on string ''` (1 failed, 23 passed). GREEN: channels.test.ts 24 passed; root npm test server 218 passed, web 25 passed; typecheck clean.
