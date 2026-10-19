# M2 final fix report
1. I-1 server/src/channels/slack.ts:6-8: require prefix https://hooks.slack.com/services/ + reject '…'. Tests: channels.test.ts "rejects the masked form and non-/services/ paths"; api-user.test.ts "PATCH with the masked config echoed from GET → 400, stored secret intact". RED: both failed (expected true to be false; expected 200 to be 400). GREEN after. Existing fixtures already used /services/ (the http://hooks.slack.com/x ones are rejected anyway).
2. M-2 rename: admin-routes.ts:16-17,77 poll_interval_s -> pollIntervalS; api-admin.test.ts updated. RED: "PATCH updates enabled and pollIntervalS" expected 400 to be 200. GREEN.
3. M-3 main.ts: startScheduler now after await app.listen.
4. M-6 user-routes.ts:56 shortcut comment.
5. M-9 main.ts: dataDir = fileURLToPath(new URL('../../data/', import.meta.url)); DB_PATH env still wins. Run from server/ (macOS has no `timeout`; used background run + kill): log "World Alerts API on http://127.0.0.1:3998"; ../data held alerts.db(+shm/wal); port 3998 freed after kill; ../data removed (outbox dir is created lazily, none created).
Suite: Test Files 13 passed (13), Tests 214 passed (214). typecheck: tsc --noEmit clean.
