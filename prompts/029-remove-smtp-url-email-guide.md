# 029 — Remove SMTP_URL; write an email-setup guide for future users

**Date:** 2026-10-20

## Prompt

```text
pls remove the smtp_url you mentioned, also add a description to the future users how to set one email sending if they want to
```

## Outcome

- Removed the `SMTP_URL` line, which held the Gmail App password, from the local git-ignored `.env`. Emails fall back to `data/outbox/`. `SMTP_FROM` and `SLACK_DRY_RUN=0` stay.
- Wrote [`docs/email-setup.md`](../docs/email-setup.md):
  - how outbox mode and SMTP mode work
  - the variables and URL rules (`smtps` vs `smtp`, `%40` encoding)
  - a 6-step setup ending in Send test and real alerts
  - provider examples (Gmail App password, transactional providers and sender verification, local Mailpit)
  - a troubleshooting table and security notes
- The README "Real email" section now gives a short summary and links to the guide; `.env.example` and `docs/how-to-test.md` point to it too.

## Commit

_pending — backfilled in the next commit_
