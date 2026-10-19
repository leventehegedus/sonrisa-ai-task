### Spec Compliance
- ✅ Spec compliant (one wording deviation, Minor)
- ⚠️ Cannot verify from diff: lockfile (excluded), `npm run build` / root `npm test` exit codes (taken from report; static reading is consistent with both), live proxy evidence (only the evidence file), Radix grep (button.tsx:4 `import { Slot } from "radix-ui"` is visible in the diff, so confirmed).

### Strengths
- Only button and card added. Demo assets, App.css and the template README are gone, and index.html has no favicon link.
- Root wiring matches the brief: workspaces `["server","web"]`, `dev` via concurrently, `test` is `npm test -w server -w web --if-present`. Web has no `test` script, so it is skipped and the server suite still runs.
- vite.config.ts proxies `/api` to `http://localhost:3000` and sets the `@` alias via fileURLToPath (ESM-safe).
- Evidence file is honest: real curl output, dev log, shutdown and no-listeners check, and it says `data/` was not created.
- The shortcut comment is exactly as specified (App.tsx:15).

### Named risks
1. App.tsx effect: OK.
   - The `cancelled` flag in cleanup guards unmount and the StrictMode double-invoke. The first run's result is dropped, the second one wins.
   - A Retry during an in-flight request bumps `attempt`, so the old effect is cancelled and its late response is ignored. No stale overwrite.
   - Non-2xx throws `HTTP <status>` before any `res.json()`, so a non-JSON error body never reaches the parser. A 200 with an HTML body makes `res.json()` throw a SyntaxError, which the catch shows as the message. Nothing crashes.
   - Two small things: the request is not aborted (no AbortController), only ignored, and `setStatus({kind:'loading'})` runs synchronously in the effect body (one extra render). Both are fine for a scaffold.
2. Leftovers and extra dependencies: nothing stock is left that the brief said to remove.
   - Extras in web/package.json: `lucide-react` (package.json:19) is unused by button and card. It is only the shadcn `iconLibrary` default, and `components.json` also references it. Harmless and what init produces. `oxlint` and `web/.oxlintrc.json` come from the Vite template; the `lint` script is not wired into the root.
   - `@types/node` is needed by vite.config.ts. `shadcn`, `tw-animate-css` and `@fontsource-variable/geist` are all imported by index.css (lines 2-4).
   - `cn` (the npm package, `export { cn } from "cn"`, utils.ts:1) replaces clsx and tailwind-merge. The controller already vetted it; keep the new-package risk in mind (v0.5.0, 3 days old).
3. TS7 alias: OK.
   - `paths` without `baseUrl` uses the relative `./src/*` (tsconfig.app.json:11). tsconfig.json also declares it (line 3), which is what the shadcn CLI reads.
   - Vite resolves `@` through its own alias, so the two resolvers are independent. The reported `tsc -b && vite build` exit 0 means both resolved `@/components/ui/*`.
   - The tsconfig.json copy is redundant for tsc (`files: []`) but needed by shadcn detection.
4. Root `npm test`: `--if-present` skips the web workspace, so the server suite runs and exit is 0 (report: 214 passed). No change to the test script was needed. Static reading agrees.

### Issues
#### Critical (Must Fix)
None.
#### Important (Should Fix)
None.
#### Minor (Nice to Have)
- App.tsx:36 renders "Connected to API as Anna (HU, admin)"; the brief says "Connected as Anna (HU, admin)". Controller clarification only says "connected", so likely acceptable. Align the wording if the brief text is meant literally.
- package.json:1-20 reformats the whole file (arrays expanded onto multiple lines), which adds diff noise. Functionally irrelevant.
- Root `typecheck` still covers only the server (package.json "typecheck"). Web is type-checked only inside `npm run build -w web`. Consider adding web to typecheck in 11b/11c.
- Proxy target `localhost` while the server logs `127.0.0.1:3000`. It worked live (evidence file), and Node 24 happy-eyeballs handles ::1 vs 127.0.0.1, so no action.
- The error and loading UI were never exercised in a browser (report admits it). The "API not reachable: HTTP 500" case occurs when the Vite proxy cannot reach the server, so it would be worth one manual look.
- Retry button is shown even when connected and is not disabled while loading. Matches the brief ("+ Retry Button"); fine.

### Assessment
**Task quality:** Approved
**Reasoning:** The scaffold, proxy, alias and root wiring match the brief and the binding decisions (no Redux, only button and card). The fetch effect handles unmount, StrictMode, retry-in-flight and non-JSON error bodies correctly, and the TS7 alias workaround is sound. Only cosmetic and wording nits remain.
