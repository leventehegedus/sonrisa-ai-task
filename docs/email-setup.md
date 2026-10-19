# Setting up real email sending

By default World Alerts **doesn't send real email**. Each alert is written as a JSON file to `data/outbox/`, so the app works with zero setup and never mails anyone by accident. To deliver to real inboxes, point it at an SMTP server.

## How it works

| `SMTP_URL` | What happens to an email alert |
|---|---|
| not set, or empty | written to `data/outbox/<time>-<id>-<to>.json` and logged in the server console |
| set | sent through that SMTP server |

Settings are read **once, at server start**, from real environment variables or from a repo-root `.env` file. `.env` is git-ignored, and real environment variables win over it.

| Variable | Example | Meaning |
|---|---|---|
| `SMTP_URL` | `smtps://user%40example.com:PASSWORD@smtp.example.com:465` | SMTP server and credentials, as one URL (nodemailer format) |
| `SMTP_FROM` | `World Alerts <alerts@example.com>` | sender shown in the email; default `World Alerts <alerts@world-alerts.local>` |

**URL rules:**
- Use `smtps://` for port 465 (TLS from the start) and `smtp://` for port 587 or 25 (upgraded with STARTTLS).
- Special characters in the username or password must be URL-encoded. The common one is `@`, which becomes `%40` (`you%40gmail.com`).

## Step by step

1. **Get SMTP credentials** from your provider (see below).
2. **Create `.env`:**
   ```bash
   cp .env.example .env
   ```
   In `.env`, **remove the leading `#`** from the `SMTP_URL` and `SMTP_FROM` lines and fill them in.
3. **Restart the server** (Ctrl+C, then `npm run dev`). The settings are only read at start-up.
4. **Add your address as a channel:** open http://localhost:5173, then **Channels → Add channel → email**, enter your address, and click **Add channel**.
5. **Press "Send test"** on that channel.
   - Success: the toast says **Test sent**, and an email with the subject `[World Alerts] World Alerts test message` arrives.
   - Failure: the toast says **Test failed: …** with the reason.
6. **Get real alerts:**
   - In **My alerts**, edit a rule (for example **Default**) and tick the email channel.
   - Any event that scores above the rule's threshold is now emailed to you, within about 10 s.
   - To try it immediately, an admin can use **Admin → Inject event** (for example country `HU`, severity `0.6`).

## Provider examples

### Gmail (personal accounts)
1. Turn on **2-Step Verification** for the Google account.
2. Create an **App password** at https://myaccount.google.com/apppasswords. Name it `World Alerts` and copy the 16 characters, without spaces.
3. In `.env`:
   ```
   SMTP_URL=smtps://you%40gmail.com:YOUR16CHARAPPPASSWORD@smtp.gmail.com:465
   SMTP_FROM=World Alerts <you@gmail.com>
   ```
Gmail always sends as the logged-in account, whatever `SMTP_FROM` says.

### Other providers (Outlook/Microsoft 365, SendGrid, Mailgun, Amazon SES, …)
Use the SMTP host, port and credentials your provider gives you, for example:
```
SMTP_URL=smtp://USERNAME:PASSWORD@smtp.your-provider.com:587
SMTP_FROM=World Alerts <alerts@your-verified-domain.com>
```
Transactional providers (SES, Mailgun, SendGrid) **reject a sender they haven't verified**. Set `SMTP_FROM` to an address or domain you've verified with them.

### Local testing without a real mailbox
[Mailpit](https://mailpit.axllent.org/) catches every email in a local web inbox, so nothing is really delivered:
```bash
brew install mailpit && mailpit          # web inbox on http://localhost:8025
```
```
SMTP_URL=smtp://localhost:1025
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Test sent", but a JSON file appeared in `data/outbox/` and no email arrived | `SMTP_URL` isn't set (still commented out with `#`?), or the server wasn't restarted |
| `Test failed: Invalid login` / `535` | wrong password, an App password not created or revoked, or `@` in the username not encoded as `%40` |
| `Test failed: … ECONNREFUSED` / timeout | wrong host or port, or the network blocks outgoing SMTP |
| The email arrives in spam | normal for new senders; mark it "not spam" or use a verified sending domain |
| Real alerts don't arrive, but "Send test" works | the email channel isn't ticked in a rule, or no event scored above the rule threshold. Check **History** (or **Admin → Deliveries**) for its status and the **Why** column |

## Security

- **Never commit `.env`** or paste credentials into issues, docs or chat. `.env` is git-ignored; keep it that way.
- The API never returns `SMTP_URL`, and error messages are scrubbed of secrets.
- Prefer an App password or an API key that can be **revoked**, and revoke it when you stop using it. After revoking, delete the `SMTP_URL` line (emails fall back to `data/outbox/`) or put in a new one, then restart.
- Real email delivery was verified with Gmail on 2026-10-20 (see [`verification.md`](verification.md)).
