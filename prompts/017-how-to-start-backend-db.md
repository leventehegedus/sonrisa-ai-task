# 017 — How to start the backend and the database

**Date:** 2026-10-19

## Prompt

```text
how shall I start the backend and the database?
```

## Outcome

- The agent explained, after checking `package.json`, `server/package.json` and `server/src/main.ts`:
  - The database is an embedded SQLite file. There's no separate DB server to start.
  - `npm run dev -w server` (or `npm run dev` for server + web) creates `data/alerts.db` with the schema, seeds users and sources, and starts polling.
  - It also covered the env vars and how to reset the data.
- No code changes.

## Commit

`2c8a300` — docs: log prompt 017
