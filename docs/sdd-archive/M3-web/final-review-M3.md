# Final review M3 (feat/web, head 0e26752)

### Browser walkthrough
Isolated API :3001 (temp DB) + vite :5174, driven with Playwright MCP (real Chromium). All steps worked:
- Header "Anna (HU)" + admin badge; tabs My alerts/Channels/History/Admin; Default rule listed (threshold 0.5 -> #1).
- Switched to Bence: Admin tab gone, header "Bence (HU)", own rules/channels only (channel #2).
- Bence created rule "Bence quakes" (threshold 0.30 via slider keys, step 0.05, email #2): listed immediately (tag invalidation OK).
- Channels: bence@example.com, "Send test" -> toast "Test sent".
- Back to Anna -> Admin: Users table (3 users), Inject dialog (HU, severity 0.6) -> toast "2 deliveries created".
- Admin Deliveries: 2 rows (Bence, Anna) status sent, Why "0.60 x 1.00 (home) = 0.60 / >= 0.5". Sources: 5 sources (GDACS, CoinGecko, Telex, HVG, BBC World), toggle, interval+Save, Poll now.
- Console: 0 warnings; 1 error = GET /favicon.ico 404 (no favicon). No other errors.
- Screenshots: /private/tmp/claude-501/-Users-leventehegedus-sonrisa-ai-task/8c1de3d3-079f-4bed-abad-d3232cea2d47/scratchpad/01-bence-channels.png, 02-admin-deliveries.png, 03-admin-sources.png (same dir).
- Cleanup: processes killed, :3001/:5174 free. Removed the 3 outbox files I created (bence/anna from the inject, bence from Send test); the 18 pre-existing files untouched. Removed untracked .playwright-mcp/ created by the browser tool. git status clean.

### Strengths
- Spec §12 fully covered; single `api` slice with tag invalidation; invalidations sensible (deleteChannel also invalidates Rules; inject invalidates Events/Deliveries/MyDeliveries).
- Score breakdown (severity x proximity (reason) = importance >= threshold, override badge) visible in History and Admin Deliveries = "why it fired".
- Secrets: Slack webhook masked server-side, UI only sends config when user typed a replacement (R-018); no secret rendered.
- errorText renders `{error, issues}`; toasts/inline alerts used consistently. Session switch resets API cache (no cross-user leak). Small, no over-engineering; tests target behaviour.

### Issues
Critical: none.
Important: none.
Minor:
- web/index.html: no favicon -> 404 console error on every load. Add `<link rel="icon" href="data:,">`.
- web/src/api.ts getDeliveries: status interpolated unencoded in URL (values are a fixed enum; harmless).
- Admin Users table: role cell blank for non-admins (cosmetic; could show "user").
- Whole admin shell mounts all tab panels' DOM (hidden duplicates seen in snapshot); fine at this scale.

### Deferred-minor triage
- unused lucide-react: can wait (shadcn default).
- root typecheck covers server only: can wait; web build runs tsc.
- loading/error UI not viewed in browser: Connecting... and loaded states viewed now; error state still untested in browser; can wait.
- root package.json reformatted: can wait.
- no tests for localStorage fallbacks/getUsers/401, load() any positive int: can wait (999 -> 401 page recoverable via switcher).
- no tests for slider/editing rule; delete without confirm: can wait.
- admin->admin guard: already folded in (AppShell `!me ||`).
- source Switch no error handling; interval clear -> 400 toast; inject dialog error not cleared on close; no Deliveries filter test; /me failure leaves admin tab blank: can wait (server validates; failure shows API-not-reachable banner).

### Declined to judge
Visual polish beyond shadcn defaults; accessibility audit; behaviour in non-Chromium browsers; real SMTP/Slack delivery.

### Ready to merge? Yes
(optional one-line favicon fix before or after merge)
