# 028 — Slack confirmed; the user will revoke the Gmail password

**Date:** 2026-10-20

## Prompt

```text
it works fine with slack too, and I'll revoke the gmail pass as you mentioned
```

## Outcome

- Real Slack delivery is now **verified**: Slack accepted the post (prompt 027) and the user saw the message arrive. `docs/verification.md` and the requirements checklist in `docs/testing-walkthrough.md` were updated (Slack ⚠️ → ✅).
- The user will revoke the Gmail App password. Note: a revoked password makes real email sends fail with an auth error until `.env` gets a new one or `SMTP_URL` is removed, which falls back to the outbox.
- Remaining open items: the dry-run "Test sent" UX fix (offered), and pushing to GitHub (needs the user's go-ahead).

## Commit

`edbaca1` (merge of `docs/slack-confirmed`), plus a stale-line cleanup merge
