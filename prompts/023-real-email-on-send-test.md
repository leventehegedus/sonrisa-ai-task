# 023 — Will "Send test" reach my real email address?

**Date:** 2026-10-20

## Prompt

```text
shall i receive an email to my real email adress if i press sent test?
```

## Outcome

- The agent checked `server/src/channels/email.ts` and answered **no, not by default**. Without `SMTP_URL`, the email is written as a JSON file to `data/outbox/`, and the seeded channels point at `@example.com` addresses.
- To get a real email, the user needs both:
  - `SMTP_URL`, for example Gmail with an app password
  - an email channel whose "to" is their own address
- **Gap found:** the sender is hard-coded as `alerts@world-alerts.local`. Gmail rewrites it, but providers like SES or Mailgun reject an unverified From. A small `SMTP_FROM` env var would fix it. The agent offered this but didn't implement it (the user only asked a question).

## Commit

_pending — backfilled in the next commit_
