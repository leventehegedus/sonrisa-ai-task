# Review: bd969ae (SMTP_FROM + .env support)

Read-only review. Checked the diff, `server/src/main.ts`, `server/src/channels/*.ts`, `server/src/db/seed.ts`, `server/test/channels.test.ts`, `README.md`, `.env.example`, `.gitignore`, and `docs/evidence/smtp-ethereal-check.md`. Ran small Node scripts in the scratch dir to check `process.loadEnvFile` precedence and nodemailer with an empty string. Tests were not re-run.

### Verdicts

1. **SMTP_FROM threading: pass.**
   - `server/src/main.ts:26` sets `from: process.env.SMTP_FROM || undefined`.
   - `server/src/channels/index.ts:16` (`createChannelRegistry` opts) and `:23` pass `from` to `emailAdapter`.
   - `server/src/channels/email.ts:4` adds `from?: string` to `EmailOpts`, and `:24` uses `from: opts.from ?? 'World Alerts <alerts@world-alerts.local>'`.
   - Default is unchanged. Tests `server/test/channels.test.ts` (new "uses SMTP_FROM" and "defaults the sender") check the outbox JSON that jsonTransport writes, which is the `sendMail` payload. The custom test asserts `ops@test.local` is present and `world-alerts.local` is absent.

2. **.env loading: pass.**
   - `server/src/main.ts:7-8`: `new URL('../../.env', import.meta.url)` resolves to repo root, the same base as `dataDir` at `:15`. It works from any cwd.
   - Missing file: `existsSync` guards the call, so no crash.
   - Ordering: the `loadEnvFile` call at `:8` runs before the first `process.env` read at `:14`. The only other `process.env` reads are at `:22`, `:25`, `:26`, `:28`, all below it. I grepped `server/src` and found no module-level env reads in the imported modules, so the imports are safe too. `web/vite.config.ts:12` is a separate process.
   - Precedence: verified empirically. With `PORT=5000` in the real env and `PORT=4000` in `.env`, the result is 5000. With no real env var, `.env` applies. Real env vars win, as the comment says.
   - Node: `process.loadEnvFile` needs Node 20.12+ or 21.7+. Root `package.json` has `engines.node >=24`, so this is fine.

3. **`??` to `||` for PORT and DB_PATH: pass, with one real issue in a nearby read.**
   - `PORT=''` and `DB_PATH=''` now fall back to defaults. Before, `Number('')` gave `0` (a random port) and `openDb('')` used a temp DB. The change is correct.
   - `SLACK_DRY_RUN=''` (line 28, unchanged): `'' !== '0'` is true, so dry-run stays on. Safe default.
   - `SEED_SLACK_WEBHOOK=''`: `seed.ts:30` uses a truthy guard, so no broken Slack channel is seeded. Harmless.
   - **`SMTP_URL=''` is not harmless.** `email.ts:24` uses `opts.smtpUrl ?? { jsonTransport: true }`. An empty string is not nullish, so `createTransport('')` is called. I ran it: it throws `Cannot create property 'mailer' on string ''`. The `if (!opts.smtpUrl)` outbox branch at `email.ts:~32` treats `''` as unset, so the two checks disagree. Effect: a user who keeps the line `SMTP_URL=` in `.env` (an easy edit from `.env.example`) gets every email send failing instead of falling back to the outbox. The bug predates this commit, but this commit makes the `.env` path the usual way to set it.

4. **No real address or credential in committed files: pass.**
   - `git ls-files` shows only `.env.example`. There is no committed `.env`. `.gitignore` has `.env`.
   - `.env.example` lines 2-3 use `you@gmail.com` and `APP_PASSWORD`. These are placeholders.
   - The diff's added lines contain no real credentials. The password in `docs/evidence/smtp-ethereal-check.md` is `***REDACTED***`.
   - The other email-looking hits in the repo (`docs/evidence/feed-probes-*`, `server/test/fixtures/*.xml`, `docs/ai-review-log.md`) are pre-existing public feed authors and are not part of this change.
   - Minor: the evidence file shows the Ethereal login username `sxog73laqbcsagss@ethereal.email` (`%40`-encoded). It is a throwaway test account and not the user's address, so it is acceptable. Redacting it would be stricter.

5. **README: pass.**
   - `README.md:48`: `smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465` is correct. `smtps://` means implicit TLS, which is right for port 465, and `%40` encodes the `@`.
   - Step 2 `cp .env.example .env` matches the file.
   - The sentence about Gmail rewriting From to the authenticated account is accurate.
   - The env table row for `SMTP_FROM` and the default value match `main.ts` and `email.ts`.
   - Step 4 ("add an email channel with your address, press Send test") describes UI I did not check. It is consistent with the Ethereal evidence flow.

### Issues

**Critical**
- None.

**Important**
- `server/src/channels/email.ts:24`: `opts.smtpUrl ?? { jsonTransport: true }` should be `opts.smtpUrl || { jsonTransport: true }`. With `SMTP_URL=` in `.env`, nodemailer throws `Cannot create property 'mailer' on string ''`, so sends fail instead of falling back to the outbox. This is the same `??` vs `||` class of bug the commit fixes for PORT and DB_PATH. Add a test: `reg({ smtpUrl: '' })` writes to the outbox. Pre-existing, but reachable through the new `.env` path.

**Minor**
- `docs/evidence/smtp-ethereal-check.md`: the throwaway Ethereal username is shown. It is harmless, but the brief only required the password to be redacted.
- The evidence says "emailAdapter does not return the send info, so the preview URL comes from a one-off script". The commit is fine, but the claim "real output" depends on that script, which is not committed. Note this where the reader will see it.
- Tests were not re-run in this review. The brief asked for `npm test` and `npm run typecheck -w server`. Please confirm they pass after the fix above.

### Verdict

**Needs fixes.** Everything in the brief checks out except the empty `SMTP_URL` case. The fix is a single `||` at `server/src/channels/email.ts:24` plus a test for an empty `smtpUrl`. After that, this is ready to approve.
