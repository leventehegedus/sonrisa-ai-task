### Spec Compliance
- ✅ Spec compliant (endpoints, tags, `pollIntervalS`, upper-cased country, `N deliveries created` toast, Retry only on failed, Switch sends `{enabled}` only, poll toast, AppShell `!me` fallback guard plus test). New `dialog.tsx` imports `radix-ui`, which is in web/package.json.
- ⚠️ Cannot verify from diff: the isolated-port manual check is curl evidence only (report: "browser UI not driven"); evidence file is only partly in the diff.

### Strengths
- Tests assert the exact request body (`toEqual`) and exact toast/alert text, so they are real behaviour tests.
- Minimal PATCH bodies; dialog builds the body with optional fields omitted.
- AppShell fix is small, with a deterministic delayed-/me test.
- Error surfaces: inline alert in the dialog, retry/list errors rendered.

### Named risks
1. RED evidence: the inject, interval-save and poll-now tests were RED only from missing elements, but their assertions would still fail on wrong behaviour. Inject: `toEqual({category,title,country:'HU',severity:0.6})` (wrong body, un-upper-cased country, or stray `""` fields fail) and `findByText('2 deliveries created')`. Interval: `toEqual({pollIntervalS:600})`. Poll: exact `Feed 3: 4 new events` and `Feed 3 failed: HTTP 503`, plus call count 2. Acceptable, no mutation needed.
2. Inject validation: slider min 0, max 1, step 0.05, so bounds are fine. Empty summary/url/country are omitted (InjectEventDialog.tsx:27-29). URL is sent only when provided; the "provided url" path is untested.
3. Secrets and non-admin: no channel config is rendered anywhere in admin views (only title, status, lastError, breakdown). Admin content is not reachable for non-admins: `adminTab` is in `visible` only when `me?.isAdmin`. On user switch `resetApiState` makes `me` undefined, so no TabsContent for admin renders even though `tab` stays 'admin'. The server also enforces 403.
4. Interval: `type=number` with min/max, but nothing is enforced client-side. An empty or cleared field gives `Number('')===0`, which is enabled for Save and sends 0. The server 400 is shown as a toast (Sources.tsx:24), not inline. NaN cannot occur (number inputs give '' not text), so no NaN is sent. Acceptable, but out-of-range input is not prevented and is untested.

### Issues
#### Critical (Must Fix)
None.
#### Important (Should Fix)
None.
#### Minor (Nice to Have)
- Sources.tsx:38 — the enabled Switch calls `update(...)` with no error handling, so a failed PATCH silently snaps back. Add the same toast.error as `save`.
- Sources.tsx:20-26,43-47 — add a client-side guard (disable Save unless integer in 60..86400) and a test for the 400 path; as-is, empty or out-of-range input sends 0/garbage and relies on the server.
- InjectEventDialog.tsx:21,34 — `error` is not cleared when the dialog closes, so a stale error shows on reopen. Title is not required client-side (the server 400 shows inline, which is fine).
- admin.test.tsx — no test for the Deliveries status filter (`?status=failed`) or for the url-provided inject body.
- AppShell.tsx:25 — if `/me` fails, `!me` keeps `tab='admin'` with a blank panel; harmless.

### Assessment
**Task quality:** Approved
**Reasoning:** Requirements and rulings are met, and the tests assert concrete bodies and toast texts that would catch wrong behaviour. No secrets are rendered and admin content is gated; only polish items remain (silent switch failure, unvalidated interval).
