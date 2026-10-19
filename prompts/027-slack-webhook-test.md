# 027 — Use the Slack webhook and test real delivery

**Date:** 2026-10-20

## Prompt

```text
here is my webhook url, go on with it
[REDACTED — Slack Incoming Webhook URL]
```

(**Redacted on purpose**, like prompt 025: anyone holding the URL can post to the user's Slack channel, and this file will be public.)

## Outcome

- `SLACK_DRY_RUN=0` was appended to the git-ignored `.env`. The webhook URL itself isn't stored in any file; it was only used in a temp DB.
- **Real send:** an isolated API instance (`PORT=3005`, temp DB; the user's :3000 instance was untouched) created a slack channel. The API returned the webhook masked (`…/AGC2`). `POST /api/channels/4/test` returned `{"ok":true}`, with no dry-run log line, so Slack accepted a real POST. The instance was stopped afterwards.
- The agent can't read Slack, so it asked the user to confirm the message appeared. `docs/verification.md` records this as "awaiting the user's confirmation".
- Advised: if the URL leaks, regenerate it (Slack app → Incoming Webhooks → remove and add again).

## Commit

`61f219b` (merge of `docs/slack-verified`)
