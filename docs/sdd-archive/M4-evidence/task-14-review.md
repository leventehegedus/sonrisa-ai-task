### Spec Compliance
- ✅ Spec compliant, with the Minor deviations below. The spec is the brief plus the controller rulings (isolated stack, `e2e` script, 6 screenshots, favicon, Slack marked dry-run only, verification map and "Not verified" list, README).
- ⚠️ Cannot verify from the diff: that the e2e run passes. I only inspected the spec, the config and 2 of the 6 PNGs.
  - `4-admin-deliveries.png` shows Priya, Bence and Anna on the NP 1.0 event with "critical override" badges.
  - It shows Bence and Anna on the HU 0.6 event, and no Priya row. This matches the claim "0.60 x 1.00 (home) = 0.60".
  - `6-inject-dialog.png` shows the dialog with HU and severity 0.60, as claimed.

### Strengths
- The e2e stack is honestly isolated:
  - Ports are :3002 and :5175, and the DB is under /tmp.
  - `reuseExistingServer: false` plus `--strictPort` means a collision fails loudly instead of silently reusing the user's instance.
  - The root `npm test` is unchanged.
- The spec cleans up only the outbox files it created. It handles the repo-root `data/outbox` leak that `main.ts` cannot avoid, and says so.
- verification.md is conservative:
  - Real Slack is stated as untested.
  - The "Not verified" list is long and specific (SMTP, Retry click in the browser, `sent` status in the browser, git-history secret scan).
  - The "Partial" result on goal 4 is honest.
  - The flake is disclosed rather than hidden.
- README ports, env vars and defaults match `main.ts` and `vite.config.ts`. Seeded users match `seed.ts`. The README retry values (30s, 60s) match `BASE_BACKOFF_MS = 30_000`.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None. The one near-miss (README SEED_SLACK_WEBHOOK wording) is listed as Minor, because it is not a claim of verification.

#### Minor (Nice to Have)
1. README.md, env table, `SEED_SLACK_WEBHOOK` row: "gives the seeded users a Slack channel". `seed.ts:30` adds it to Bence only. Fix: "gives Bence a Slack channel".
2. `index.html:6` favicon is `<link rel="icon" href="data:," />`. This is a blank icon that only suppresses the 404. Fine if that was the ruling, but a reader of "favicon" in the brief may expect an actual icon. State it in the report.
3. `playwright.config.ts:4,13`: `rm -rf /tmp/world-alerts-e2e` is a fixed shared path.
   - Two concurrent `npm run e2e` runs would delete each other's DB, but the fixed ports already stop a second run.
   - It uses a POSIX-only shell command (`rm -rf`, `mkdir -p`), so it is not portable to Windows.
   - It is safe with respect to `data/alerts.db` and :3000/:5173. `mkdtemp` would be cleaner.
4. `e2e/screenshots.spec.ts:12-17`: `afterAll` deletes any new file in repo-root `data/outbox` during the run. If the user's dev instance (:3000) delivers an email in that window, it is deleted too. The window is small and the data is demo data.
5. `6-inject-dialog.png` shows a stale "Test sent" toast from the earlier Channels step behind the dialog. Cosmetic. Dismissing it, or reordering, would give a cleaner screenshot.
6. The e2e server polls the live feeds (the scheduler runs in the e2e API), so the run needs no network but may touch it. verification.md says live content is not asserted, which is accurate.

### Named risk 1: honesty of verification.md (8 rows spot-checked, no overclaims)
All cited test names exist and assert what is claimed:
- `channels.test.ts:18` "writes one JSON file in outbox containing the title".
- `dispatch.test.ts:36` "sends a due delivery and marks it sent".
- `channels.test.ts:60` "posts { text } once to the url" and `:96` "dry-run logs and does not fetch".
- `api-admin.test.ts:89` "HU severity 0.6" and `:96` "Red severity 1.0 in NP".
- `ingest.test.ts:33` "re-ingesting the same event" and `:42` "two rules matching on the same channel".
- `dispatch.test.ts:110` "does not retry (no duplicate send)" and `:92` "scrubbed of the webhook url".
- `channels.test.ts:79` "throws on 500 without leaking", `:116` "masks to last 4".
- `api-user.test.ts:151` "never contains the webhook secret".
- `api-admin.test.ts:118` "never leaks a Slack webhook" and `:141` "retry: failed → pending".
- `chain.test.ts` full chain (describe at line 18) and the first-poll baseline (`chain.test.ts:19`, `poll.test.ts:132`).

Other claims also check out:
- `scoring.test.ts` has exactly 12 `it.each` rows, matching "the 12 worked examples".
- There are 13 server test files and 5 web test files, matching "13 files / 5 files".
- `admin.test.tsx:79` covers Retry in the unit tests only, as stated.
- `AppShell.test.tsx:58` covers the Admin tab being absent for a non-admin.
- A "fake" adapter exists in `dispatch.test.ts:17`.
- Goal 6 ("Pass on this machine") is hedged adequately.

Two soft spots, not overclaims:
- The row 4 "Partial" label is appropriately hedged.
- "Process claim" is stated for the last anti-goal.

Small mismatch: the table writes "0.60 x 1.00"; the UI shows "×". Harmless.

### Named risk 2: README accuracy
Correct:
- Commands `npm install && npm run dev`, `npm test`, `npm run typecheck`, `npm run build -w web`, `npm run e2e`.
- Ports: API 127.0.0.1:3000, web :5173. The README does not state that Vite defaults to 5173, but this matches the brief.
- Env vars `PORT`, `DB_PATH` (default `data/alerts.db`), `SMTP_URL`, `SLACK_DRY_RUN` (default 1, `0` = real), `API_TARGET` (default http://localhost:3000).
- Seeded users: Anna HU admin, Bence HU, Priya NP.
- The five sources: GDACS, CoinGecko, Telex, HVG, BBC.

Inaccuracies: only Minor 1 above. Also, "unless SMTP_URL is set" is plausible, since `main.ts` passes `smtpUrl`.

One unverified-but-likely detail: the scoring numbers in the README (0.75, 0.4, 0.2, 0.8). They match the scoring.test rows (RO subregion 0.525 = 0.7 x 0.75, ES continent 0.28 = 0.7 x 0.4, elsewhere 0.2, global 0.8).

### Named risk 3: playwright.config
- The DB is fresh per run. `rm -rf /tmp/world-alerts-e2e && mkdir -p ... && npm run start -w server` runs as the first webServer command, with `DB_PATH` inside it. The seed runs on an empty DB.
- It cannot collide with the user's instance:
  - Different ports (:3002, :5175), and `API_TARGET` points the e2e web server at :3002.
  - `reuseExistingServer: false` fails the run if :3002 or :5175 is busy.
  - `data/alerts.db` is never touched.
- One shared-state leak remains: the outbox (Minor 4).
- The readiness URL `/api/me` returns 401 and Playwright counts it as up. That is fine and commented.

### Named risk 4: Flake diagnosis
Test: `web/src/components/AppShell.test.tsx:73-92`, "falls back to My alerts when the active Admin tab disappears after switching to a non-admin". The failure `expected 'false' to be 'true'` is the `aria-selected` assertion at line 83. Line 90 has the same shape but is less likely.

**Root cause (high confidence):** a transient state in `AppShell`, which the test races against.
- `switchUser` (`web/src/session.ts:33-38`) dispatches `setUser` and then `api.util.resetApiState()`. That empties the cache, so `useGetMeQuery().data` becomes `undefined` until the new `/me` returns.
- With `me === undefined`, `AppShell.tsx` computes `visible = tabs`. This list has no Admin tab. It also computes `active = (!me || …) ? tab : 'alerts'`, which keeps `tab === 'admin'` on purpose, so admin to admin switches don't lose the tab.
- In that window the Admin trigger is gone. `<Tabs value="admin">` has no matching trigger, so no tab is selected and "My alerts" has `aria-selected="false"`.
- The test does `await waitFor(() => expect(queryByRole('tab', {name:'Admin'})).toBeNull())` at line 82. That passes during the reload window, not only after Bela's `/me` lands.
- Line 83 then does `(await findByRole('tab', {name:'My alerts'})).getAttribute('aria-selected')`. `findByRole` resolves immediately because the element exists, and the attribute is read once, with no retry. If the mocked `/me` fetch (a few ms) has not yet resolved, it reads `'false'`. The following `findByText('No rules yet.')` only works after `me` arrives. This is a timing race, so the 4/6 failure rate fits.

**Fix, test side (sufficient, do this):** make the assertion retry, and wait for the new user first:
```ts
await screen.findByText(/DE/) // or 'Bela (DE)': /me for Bela has landed
await waitFor(() =>
  expect(screen.getByRole('tab', { name: 'My alerts' }).getAttribute('aria-selected')).toBe('true'))
```
Apply the same retrying `waitFor` to lines 90 and 91 after `findByRole('tab', {name:'Admin'})`. Line 91 is stable once `me` has loaded. The sibling test at line 94 should be checked for the same one-shot `getAttribute` pattern.

**Optional product fix:** the transient has a real UI side effect. After a user switch, the tab bar shows no selected tab, and the panel is blank, for the duration of `/me`. Cheap fix: in the `!me` branch render the previous `visible` set, or show the "Connecting…" state and skip the tab panels while `me` is undefined.

Not the cause:
- Radix pointer events (the test uses `pointerDown` on the combobox, which works in the passing runs).
- act() warnings.
- Anything introduced in Task 14.

### Assessment
**Task quality:** Approved
**Reasoning:** The e2e harness is isolated and fails loudly on a collision, the verification report makes no overclaims (all 8 sampled rows check out, and the Slack and unverified items are honest), and the README is accurate apart from one wording slip (SEED_SLACK_WEBHOOK affects Bence only). Fix Minor 1 (one line); the rest is optional, and the pre-existing AppShell flake is diagnosed above for a separate branch.
