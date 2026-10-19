# 026 — Slack: step-by-step setup

**Date:** 2026-10-20

## Prompt

```text
check for slack pls, help me step by step what to do
```

## Outcome

- The agent checked `server/src/channels/slack.ts`, `server/src/main.ts` and the Channels page, then gave step-by-step instructions:
  - create a Slack app with an Incoming Webhook and copy its URL
  - check the URL with curl
  - set `SLACK_DRY_RUN=0` in `.env` and restart
  - add a slack channel in the UI and press Send test
  - wire the channel into a rule and inject an event
- **Gap found:** with `SLACK_DRY_RUN` on (the default), **Send test** returns `{ok:true}` and the UI says "Test sent", even though nothing was posted (the message only goes to the server log). That's misleading. The agent offered a fix (return a `dryRun` flag and show "Dry run: not sent to Slack") without implementing it.
- The webhook URL is a secret (anyone holding it can post to the channel); it goes in the UI, never into a committed file.

## Commit

`60b6695` (merge of `docs/prompt-026`)
