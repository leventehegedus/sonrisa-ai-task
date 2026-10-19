# M2 API smoke check (2026-10-19)

Real server, real network, fresh temp DB. Run from the repo root on branch `feat/api`.

## Commands

```sh
T=$(mktemp -d)
DB_PATH=$T/smoke.db PORT=3999 npm run start -w server > $T/server.log 2>&1 &
sleep 15
curl -s localhost:3999/api/me -H 'X-User-Id: 1'
curl -s localhost:3999/api/admin/sources -H 'X-User-Id: 1'
curl -s -X POST localhost:3999/api/admin/events -H 'X-User-Id: 1' -H 'content-type: application/json' \
  -d '{"category":"disaster","title":"Smoke test: árvíz Budapest","country":"HU","severity":0.6}'
sleep 11   # let one dispatcher tick (10 s) run
curl -s localhost:3999/api/admin/deliveries -H 'X-User-Id: 1'
curl -s -w ' %{http_code}' localhost:3999/api/admin/users -H 'X-User-Id: 2'
pkill -TERM -f "tsx src/main.ts"
```

## Output (trimmed only where marked)

`GET /api/me` (user 1):

```json
{"id":1,"name":"Anna","email":"anna@example.com","homeCountry":"HU","isAdmin":true}
```

`GET /api/admin/sources`, about 15 s after start. Every source has `lastPolledAt` set, `lastError: null`, and `baselineAt` set (the first successful poll is the baseline, so it creates no deliveries). Configs are shortened here as `…`:

```json
[{"id":1,"type":"gdacs","name":"GDACS","config":{},"enabled":true,"pollIntervalS":300,"lastPolledAt":"2026-10-19T18:41:41.684Z","lastError":null,"baselineAt":"2026-10-19T18:41:41.684Z"},
 {"id":2,"type":"coingecko","name":"CoinGecko","config":{…},"enabled":true,"pollIntervalS":300,"lastPolledAt":"2026-10-19T18:41:41.837Z","lastError":null,"baselineAt":"2026-10-19T18:41:41.837Z"},
 {"id":3,"type":"rss","name":"Telex","config":{…},"enabled":true,"pollIntervalS":300,"lastPolledAt":"2026-10-19T18:41:42.032Z","lastError":null,"baselineAt":"2026-10-19T18:41:42.032Z"},
 {"id":4,"type":"rss","name":"HVG","config":{…},"enabled":true,"pollIntervalS":300,"lastPolledAt":"2026-10-19T18:41:42.121Z","lastError":null,"baselineAt":"2026-10-19T18:41:42.121Z"},
 {"id":5,"type":"rss","name":"BBC World","config":{…},"enabled":true,"pollIntervalS":300,"lastPolledAt":"2026-10-19T18:41:42.247Z","lastError":null,"baselineAt":"2026-10-19T18:41:42.247Z"}]
```

`POST /api/admin/events` (HU, severity 0.6). Event id 363 means the baseline polls stored 362 real feed events first:

```json
{"event":{"id":363,"source":"manual","externalId":"manual:212fc3cf-f2a7-4167-9130-f98eb5886593","category":"disaster","title":"Smoke test: árvíz Budapest","summary":null,"url":null,"country":"HU","scope":"country","severity":0.6,"occurredAt":"2026-10-19T18:41:55.248Z","raw":{"category":"disaster","title":"Smoke test: árvíz Budapest","country":"HU","severity":0.6}},"deliveriesCreated":2}
```

`GET /api/admin/deliveries`, after one dispatcher tick. Anna and Bence (HU, importance 0.6 ≥ 0.5) each got one, and both are `sent` (email outbox mode, no `SMTP_URL`). Priya (NP) got none:

```json
[{"id":2,"status":"sent","attempts":1,"lastError":null,"createdAt":"2026-10-19T18:41:55.248Z","sentAt":"2026-10-19T18:42:00.898Z","channelId":2,"ruleId":2,"breakdown":{"severity":0.6,"proximity":1,"proximityReason":"home","override":false,"importance":0.6,"threshold":0.5,"fires":true},"event":{"id":363,"title":"Smoke test: árvíz Budapest","category":"disaster","country":"HU","scope":"country","url":null,"occurredAt":"2026-10-19T18:41:55.248Z"},"userId":2},
 {"id":1,"status":"sent","attempts":1,"lastError":null,"createdAt":"2026-10-19T18:41:55.248Z","sentAt":"2026-10-19T18:42:00.898Z","channelId":1,"ruleId":1,"breakdown":{"severity":0.6,"proximity":1,"proximityReason":"home","override":false,"importance":0.6,"threshold":0.5,"fires":true},"event":{"id":363,"title":"Smoke test: árvíz Budapest","category":"disaster","country":"HU","scope":"country","url":null,"occurredAt":"2026-10-19T18:41:55.248Z"},"userId":1}]
```

`GET /api/admin/users` as Bence (non-admin):

```
{"error":"admin only"} 403
```

Server log:

```
[2026-10-19T18:41:40.903Z] World Alerts API on http://127.0.0.1:3999
[2026-10-19T18:42:00.912Z] email (outbox) to=anna@example.com subject=[World Alerts] Smoke test: árvíz Budapest file=1792435320912-82bf9fd2-anna@example.com.json
[2026-10-19T18:42:00.915Z] email (outbox) to=bence@example.com subject=[World Alerts] Smoke test: árvíz Budapest file=1792435320915-285a9347-bence@example.com.json
```

After `SIGTERM`, `pgrep -fl src/main.ts` printed nothing and nothing was listening on port 3999.
