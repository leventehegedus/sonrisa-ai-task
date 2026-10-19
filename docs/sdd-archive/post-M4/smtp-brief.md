### Task: SMTP sender address + `.env` support, so real email can be tested

**Branch:** `feat/smtp-config` (off main `b4ca357`).

**Why:** the user wants to receive real alert emails through Gmail SMTP. Today:
1. the sender is hard-coded as `alerts@world-alerts.local` in `server/src/channels/email.ts`; strict providers (SES, Mailgun) reject unverified senders;
2. the only way to set `SMTP_URL`, which contains a password, is on the command line.

**Required:**
1. `SMTP_FROM` env var: the From address for emails. Default: `World Alerts <alerts@world-alerts.local>` (the current behaviour). Thread it through `createChannelRegistry` → `emailAdapter` as an option, the same way `smtpUrl` is. Unit test: a custom `from` reaches `sendMail` (jsonTransport output contains it), and the default is unchanged.
2. `.env` support: at the top of `server/src/main.ts`, if a repo-root `.env` exists, load it with Node's built-in `process.loadEnvFile(path)`. Resolve it the same way `dataDir` is resolved (relative to `import.meta.url`), so it works from any cwd. Real environment variables must still win over `.env`; check how `loadEnvFile` behaves and handle it. No new dependency.
3. Add `.env` to `.gitignore`. Add a committed `.env.example` with commented placeholders only (no real values): `SMTP_URL=smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`, `SMTP_FROM=World Alerts <you@gmail.com>`, `SLACK_DRY_RUN=1`, `SEED_SLACK_WEBHOOK=`, `PORT=3000`, `DB_PATH=`.
4. **Never write a real email address or credentials into any committed file.**
5. **Real SMTP check (evidence):** without touching the user's :3000/:5173 instance or `data/alerts.db`:
   - create a throwaway Ethereal account with nodemailer's `createTestAccount()` (needs network);
   - start the API with `PORT=3003 DB_PATH=$(mktemp -d)/s.db SMTP_URL=<ethereal smtp url> SMTP_FROM='World Alerts <alerts@test.local>'`;
   - as user 2, create an email channel to any address, then `POST /api/channels/:id/test`; expect `{"ok":true}`;
   - fetch the Ethereal message preview URL (`nodemailer.getTestMessageUrl` is only available inside the send; it's acceptable to instead write a tiny one-off script in the scratch dir that uses the same `emailAdapter` with the Ethereal URL and prints the preview URL);
   - record the commands and real output (redact the Ethereal password) in `docs/evidence/smtp-ethereal-check.md`;
   - stop your process and confirm :3003 is free.
6. README: add `SMTP_FROM` to the env table and a short "Real email (Gmail)" subsection: create an App password; copy `.env.example` to `.env`; fill `SMTP_URL` and `SMTP_FROM`; `npm run dev`; add an email channel with your address; press **Send test**. Also note that Gmail rewrites From to the authenticated account.

Run root `npm test` and `npm run typecheck -w server`. Commit `feat(server): SMTP_FROM and .env support for real email`, with the trailer naming your model.
