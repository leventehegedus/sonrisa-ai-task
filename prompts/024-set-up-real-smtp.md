# 024 — Set up SMTP so real email can be tested

**Date:** 2026-10-20

## Prompt

```text
okay, understand, pls go on and create the smtp server to able to test it. Here is my email adress: levi.hegedus92@gmail.com, we can use it this time
```

(The address is kept verbatim, per the prompt-logging rule. It's already the author email on every commit in this repo. It isn't written into any code, config or seed file.)

## Outcome

- The agent explained that it can't create a Gmail App password: only the account owner can. It built everything else.
- **Feature** (branch `feat/smtp-config`, sonnet implementer):
  - `SMTP_FROM` env var
  - repo-root `.env` loading via `process.loadEnvFile` (real env vars win), with `.env` git-ignored
  - `.env.example` with placeholders only
  - a README "Real email (Gmail)" section
- **Real SMTP proof:** a throwaway Ethereal account, the API on an isolated port, and `POST /api/channels/:id/test` → `{"ok":true}`; Ethereal reported `250 Accepted`. Evidence: `docs/evidence/smtp-ethereal-check.md` (password redacted).
- **Controller secret scan of the commit:** no personal address or credential in any committed file.
- **Review (haiku):** found that an empty `SMTP_URL=` would crash every send (R-024). Fixed in `896ab71` with a test; the controller verified it (218 server tests green).
- Next step for the user: create an App password, fill in `.env`, restart, add their address as a channel, press **Send test**. The agent offered to confirm arrival by searching the user's inbox read-only.

## Decisions

- D-027: Real-email setup.

## Commit

`4ef0659` (merge of `feat/smtp-config`)
