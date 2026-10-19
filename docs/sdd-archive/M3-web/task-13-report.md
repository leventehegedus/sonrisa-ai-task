# Task 13 report

Status: DONE. Commit: see `git log -1` on feat/web ("feat(web): admin views and inject event dialog").

## Built
- web/src/api.ts: admin endpoints (users, rules, events, deliveries?status, retry, sources, patch, poll, inject) with tags; types in web/src/types.ts.
- web/src/pages/admin/{AdminLayout,Users,Rules,Events,Deliveries,Sources}.tsx; web/src/components/InjectEventDialog.tsx; web/src/components/ui/dialog.tsx (via `npx shadcn@latest add dialog -y`).
- AppShell: renders AdminLayout; Admin-tab fallback skipped while `me` is undefined (`!me || visible.some(...)`).
- Source PATCH sends only the changed field ({enabled} from the Switch, {pollIntervalS} from the Save-interval button). Poll now toasts "<name>: N new events" or "<name> failed: <error>".

## RED (stub components: Deliveries rendered Retry on every row, Sources switch sent {enabled,pollIntervalS}, others returned null)
- Deliveries: `AssertionError: expected [ <button></button>, …(2) ] to have a length of 1 but got 3`
- Sources switch: `AssertionError: expected { enabled: false, pollIntervalS: 300 } to deeply equal { enabled: false }`
- Interval save / poll-now / inject dialog (x2): `TestingLibraryElementError: Unable to find a label with the text of: Poll interval (s) for source 3` / `Unable to find an element with the text: HTTP 500` / `Unable to find an accessible element with the role "button" and name "Inject event"` (stubs rendered nothing, so these fail on missing elements, not on body assertions).
- AppShell admin->admin: with the fix reverted after implementation: `AssertionError: expected 'false' to be 'true'` (Admin tab aria-selected). The existing "Coming in Task 13" test was changed to find the "Inject event" button and was RED against the placeholder.
## GREEN
`npm test`: server 13 files / 215 tests passed; web 5 files / 24 tests passed. `npm run build -w web` exit 0 (chunk-size warning only). oxlint: only pre-existing ui/* fast-refresh warnings.

## Real check
Appended to docs/evidence/m3-web-connection.md: HU 0.6 -> 2 deliveries (Anna, Bence; none for Priya); NP 1.0 -> 3 deliveries, all override=True; lowercase `hu` -> 400; PATCH enabled=false then poll -> {"ok":true,"inserted":0} (poll runs while disabled); Bence -> 403 on all /api/admin/*; retry non-failed -> 409. Only my PIDs on :3001/:5174 stopped; :3000 listener untouched; 5 outbox files I created removed (18 remain).

## Notes
- Test needed `waitFor(button enabled)` between the two poll clicks (button is disabled while polling).
- Inject dialog omits empty summary/url/country; country input is upper-cased client-side (maxLength 2).
- Browser UI not driven; covered by jsdom tests.
- Plan/spec defects: none. Brief's "UI pages carry no unit tests" superseded by controller ruling.
