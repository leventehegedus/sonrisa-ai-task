# Real SMTP check against Ethereal (2026-10-20)

Throwaway Ethereal account from nodemailer `createTestAccount()`; password redacted. The user's :3000/:5173 instance and `data/alerts.db` were not touched.

```
$ node acct.mjs   # createTestAccount() -> SMTP URL
{"url":"smtp://sxog73laqbcsagss%40ethereal.email:***REDACTED***@smtp.ethereal.email:587", ...}

$ PORT=3003 DB_PATH=$(mktemp -d)/s.db SMTP_URL=<ethereal url> SMTP_FROM='World Alerts <alerts@test.local>' npx tsx server/src/main.ts
[2026-10-19T23:11:56.222Z] World Alerts API on http://127.0.0.1:3003

$ curl -s -XPOST localhost:3003/api/channels -H 'X-User-Id: 2' -H 'content-type: application/json' -d '{"type":"email","config":{"to":"someone@example.com"}}'
{"id":4,"type":"email","config":{"to":"someone@example.com"},"enabled":true}

$ curl -s -XPOST localhost:3003/api/channels/4/test -H 'X-User-Id: 2'
{"ok":true}
```

`emailAdapter` does not return the send info, so the preview URL comes from a one-off script (kept in the scratch dir, not committed). It uses the same Ethereal transport and the same From (`World Alerts <alerts@test.local>`):

```
response: 250 Accepted [STATUS=new MSGID=atajtOO.J4b7VHftatajxcAYPlgYjkbQAAAAAig0Fr4Hmm.ltrj-06mVwDM]
preview: https://ethereal.email/message/atajtOO.J4b7VHftatajxcAYPlgYjkbQAAAAAig0Fr4Hmm.ltrj-06mVwDM
```

Cleanup: API process stopped; `lsof -iTCP:3003 -sTCP:LISTEN` prints nothing.
