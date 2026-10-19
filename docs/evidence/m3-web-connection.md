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
