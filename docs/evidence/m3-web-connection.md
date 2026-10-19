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
