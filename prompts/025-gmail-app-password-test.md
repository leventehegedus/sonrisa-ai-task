# 025 — Use the Gmail App password and test real email

**Date:** 2026-10-20

## Prompt

```text
here is the password I got, go on with it: [REDACTED — Gmail App password, 16 characters]
```

(**Redacted on purpose.** This is the one deviation from the "verbatim" rule: the prompt contained a live credential, and this file is committed and will be public on GitHub.)

## Outcome

- The password was written **only** to the git-ignored repo-root `.env`, as `SMTP_URL` (Gmail `smtps` on port 465) plus `SMTP_FROM`. `git check-ignore` confirmed `.env` is ignored. It's not in any commit.
- **Real send:** an isolated API instance (`PORT=3004`, temp DB, so the user's running :3000 instance was untouched) created an email channel to the user's own address and called `POST /api/channels/4/test`, which returned `{"ok":true}`. The instance was stopped afterwards.
- **Delivery confirmed:** a read-only Gmail connector search found `[World Alerts] World Alerts test message` in the user's **INBOX** at 23:18:22Z.
- `docs/verification.md` and `docs/testing-walkthrough.md` were updated: real email is now **verified**.
- **Security advice given:** the password appeared in the chat transcript, so revoke it after testing (Google account → App passwords) and create a new one if needed.

## Commit

_pending — backfilled in the next commit_
