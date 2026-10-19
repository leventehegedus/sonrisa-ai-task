# M3 Task 11a: web to API connection (real run)

Commands: `DB_PATH=$(mktemp -d)/w.db npm run dev` (background), wait 15 s, then curl through the Vite proxy.

```
$ curl -s localhost:5173/api/me -H 'X-User-Id: 1'
{"id":1,"name":"Anna","email":"anna@example.com","homeCountry":"HU","isAdmin":true}

$ curl -s localhost:5173/ | head -5
<!doctype html>
<html lang="en">
  <head>
    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
```

Dev log: `[server] World Alerts API on http://127.0.0.1:3000`, `[web] VITE v8.3.4 ready in 142 ms ... http://localhost:5173/`.

Shutdown: killed PIDs from `lsof -tiTCP:3000` and `lsof -tiTCP:5173` (web reported exit 143 = SIGTERM, expected). `lsof -iTCP:3000 -iTCP:5173 -sTCP:LISTEN` printed nothing (no listeners). Repo-root `data/` was not created (temp DB_PATH used).

# M3 Task 11c: user switcher and app shell (real run)

The user's own instance (:3000, `data/alerts.db`) was left alone. Isolated ports and a temp DB:

```
$ DB_PATH=$(mktemp -d)/x.db PORT=3001 npm run start -w server        # background
[2026-10-19T21:48:05.675Z] World Alerts API on http://127.0.0.1:3001
$ API_TARGET=http://localhost:3001 npm run dev -w web -- --port 5174 --strictPort   # background
  VITE v8.3.4  ready in 176 ms   ➜  Local: http://localhost:5174/

$ curl -s localhost:5174/api/users -H 'X-User-Id: 2'
[{"id":1,"name":"Anna"},{"id":2,"name":"Bence"},{"id":3,"name":"Priya"}]
$ curl -s localhost:5174/api/me -H 'X-User-Id: 2'
{"id":2,"name":"Bence","email":"bence@example.com","homeCountry":"HU","isAdmin":false}
```

Shutdown: killed only PIDs 75865 (:3001) and 75863 (:5174). `lsof -iTCP:3001 -iTCP:5174 -sTCP:LISTEN` printed nothing. The pre-existing :3000 listener (PID 74488) and `data/` were not touched.

# M3 Task 12: user pages (real run)

Isolated API on :3001 with a temp DB, Vite on :5174 proxying to it; all calls go through the Vite proxy as user 2 (Bence). The user's :3000/:5173 and `data/alerts.db` were not touched. The repo-root `data/outbox` already held 18 files; only the one this run created was removed.

```
$ curl -X POST localhost:5174/api/rules -d '{"name":"Low bar","categories":["disaster"],"keywords":["quake"],"threshold":0.3,"channelIds":[]}'
{"id":4,"userId":2,"name":"Low bar","categories":["disaster"],"keywords":["quake"],"threshold":0.3,"channelIds":[],"enabled":true}
$ curl -X POST localhost:5174/api/channels -d '{"type":"email","config":{}}'
{"id":4,"type":"email","config":{"to":"bence@example.com"},"enabled":true}
$ curl -X POST localhost:5174/api/channels/4/test
{"ok":true}
$ ls data/outbox  (diff vs before)
> 1792446921467-f2746205-bence@example.com.json
  {"from":{...},"to":[{"address":"bence@example.com"}],"subject":"[World Alerts] World Alerts test message",...}
$ curl -X POST localhost:5174/api/channels -d '{"type":"slack","config":{"webhookUrl":"https://hooks.slack.com/services/T/B/secret1234"}}'
{"id":5,"type":"slack","config":{"webhookUrl":"https://hooks.slack.com/…/1234"},"enabled":true}
$ curl -X PATCH localhost:5174/api/channels/5 -d '{"config":{"webhookUrl":"https://hooks.slack.com/…/1234"}}'   # the masked value, which the UI never sends
{"error":"invalid request","issues":[{"code":"custom","path":["webhookUrl"],"message":"must be a Slack webhook URL"},{"code":"custom","path":["webhookUrl"],"message":"must not be the masked form"}]}
```

Shutdown: killed the listeners on :3001 and :5174; `lsof` printed nothing. The outbox file was deleted. The browser UI itself was not driven here; the page behaviour is covered by the jsdom tests in `web/src/pages/pages.test.tsx`.

# M3 Task 13: admin API through the Vite proxy (real run)

Isolated API on :3001 (temp DB) and Vite on :5174 (API_TARGET=http://localhost:3001). Anna = user 1 (admin, HU), Bence = 2 (HU), Priya = 3 (NP). The user's :3000/:5173 and data/alerts.db were not touched. The browser UI was not driven; the pages are covered by jsdom tests.

```
$ curl -s localhost:5174/api/admin/users -H X-User-Id: 1
[{"id":1,"name":"Anna","email":"anna@example.com","homeCountry":"HU","isAdmin":true},{"id":2,"name":"Bence","email":"bence@example.com","homeCountry":"HU","isAdmin":false},{"id":3,"name":"Priya","email":"priya@example.com","homeCountry":"NP","isAdmin":false}]
$ inject HU 0.6 as Anna
{"event":{"id":365,"source":"manual","externalId":"manual:84bfc432-44ad-4429-a198-71df69f3d398","category":"news","title":"Task13 HU check","summary":null,"url":null,"country":"HU","scope":"country","severity":0.6,"occurredAt":"2026-10-19T22:00:05.629Z","raw":{"category":"news","title":"Task13 HU check","country":"HU","severity":0.6}},"deliveriesCreated":2}
$ GET /api/admin/deliveries
2 2 Task13 HU check pending 0.6 False
1 1 Task13 HU check pending 0.6 False
$ inject NP 1.0
{"event":{"id":366,"source":"manual","externalId":"manual:887f654a-e2cc-45bc-bbdf-9d945dd51417","category":"disaster","title":"Task13 NP check","summary":null,"url":null,"country":"NP","scope":"country","severity":1,"occurredAt":"2026-10-19T22:00:05.703Z","raw":{"category":"disaster","title":"Task13 NP check","country":"NP","severity":1}},"deliveriesCreated":3}
5 3 Task13 NP check pending 1 override= True
4 2 Task13 NP check pending 1 override= True
3 1 Task13 NP check pending 1 override= True
$ bad country lowercase
{"error":"invalid request","issues":[{"code":"custom","path":["country"],"message":"unknown ISO2 country"}]}
$ sources
1 GDACS True 300
2 CoinGecko True 300
3 Telex True 300
4 HVG True 300
5 BBC World True 300
$ PATCH source 1 enabled=false
{"id":1,"type":"gdacs","name":"GDACS","config":{},"enabled":false,"pollIntervalS":300,"lastPolledAt":"2026-10-19T22:00:00.792Z","lastError":null,"baselineAt":"2026-10-19T22:00:00.792Z"}
$ poll source 1 (disabled)
{"ok":true,"inserted":0}
$ non-admin Bence
users: {"error":"admin only"} [403]
rules: {"error":"admin only"} [403]
events: {"error":"admin only"} [403]
deliveries: {"error":"admin only"} [403]
sources: {"error":"admin only"} [403]
retry non-failed: {"error":"only failed deliveries can be retried"} [409]
```

Shutdown: killed the listeners on :3001 and :5174 (lsof empty). Outbox files created by this run were deleted (data/outbox back to its prior 18 files).
