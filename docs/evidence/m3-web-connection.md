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
