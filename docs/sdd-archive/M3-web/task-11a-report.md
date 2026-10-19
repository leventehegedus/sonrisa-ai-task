# Task 11a report

Status: DONE.

## Tooling (verified first)
- node v24.13.1, npm 11.8.0; `npm view create-vite version` -> 9.3.0; `npx shadcn@latest --version` -> 4.22.1.
- `shadcn init --help` shows `-t/--template vite`, `-b/--base radix`, `-d/--defaults`, `-y/--yes`, `--no-monorepo`, `-c/--cwd`. Ran `shadcn init -t vite -b radix -d -y --no-monorepo --cwd .` non-interactively: succeeded (no hand config needed). Then `shadcn add card -y`.
- Vite scaffold: `npm create vite@latest web -- --template react-ts --no-interactive`.

## Built
Vite react-ts web workspace, Tailwind v4 via @tailwindcss/vite, shadcn (style radix-nova, Radix) with only button + card, App.tsx (Card "World Alerts", status text, Retry button, single useEffect fetch /api/me with X-User-Id: 1, shortcut comment). Demo content removed (assets, App.css, public svgs, README, web/.gitignore, favicon link). Root: workspaces ["server","web"], dev via concurrently, concurrently devDependency; test unchanged (`npm test -w server -w web --if-present`, web has no test script). Proxy `/api` -> http://localhost:3000, alias `@` -> ./src via fileURLToPath. `.gitignore` already has node_modules and web/dist.

## Radix grep
`grep -rn "radix" web/src/components/ui` -> `src/components/ui/button.tsx:4:import { Slot } from "radix-ui"` (radix-ui ^1.8.1 in web deps).

## Verification
- `npm run build -w web`: exit 0 (tsc -b && vite build, "built in 212ms", index-*.js 255.04 kB).
- Root `npm test`: exit 0, "Test Files 13 passed (13)", "Tests 214 passed (214)".
- Live check: see docs/evidence/m3-web-connection.md; proxy returned Anna {"id":1,...,"homeCountry":"HU","isAdmin":true}, / returned Vite HTML; no listeners left; no data/ dir.

## Deviations / notes
- TypeScript 7 (from template) rejects `baseUrl` (TS5102), so the `@/*` path alias uses `paths` only, in tsconfig.json and tsconfig.app.json.
- shadcn's generated utils use the `cn` npm package (shadcn-ui/cn, official) instead of clsx+tailwind-merge; left as generated.
- Pending-state UI not browser-tested (only curl); error path not exercised live.

## Concerns
None blocking. App not viewed in a browser.
