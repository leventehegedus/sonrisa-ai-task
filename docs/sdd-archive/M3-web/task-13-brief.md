### Task 13: Admin pages

> **Amended 2026-10-19 (D-025):** this task adds the admin RTK Query endpoints. PATCH source uses `pollIntervalS` (D-020). Upper-case ISO2 country input in the inject dialog.

**Files:**
- Create: `web/src/pages/admin/{AdminLayout,Users,Rules,Events,Deliveries,Sources}.tsx`, `web/src/components/InjectEventDialog.tsx`

**Interfaces:**
- Admin uses Tabs: Users, Rules, Events, Deliveries, Sources.
  - Deliveries: a status filter, `ScoreBreakdown`, `last_error`, and a Retry button on `failed` rows.
  - Sources: an enabled `Switch`, an interval input, "Poll now" (with a toast showing the result), `last_polled_at` and `last_error`.
  - `InjectEventDialog`: category, title, summary, country (an ISO2 text input; the server validates it), and a severity slider. On success the toast reads `N deliveries created`.

- [ ] **Step 1: Manual check** (the UI pages carry no unit tests; the logic is covered server-side):
  1. As Anna, inject a `HU` news event at 0.6.
  2. Deliveries shows 2 new rows: Anna and Bence, with no row for Priya.
  3. Inject `NP` at 1.0. Deliveries shows 3 rows with the `critical override` badge.
  4. Toggle a source off, then click "Poll now". The poll still runs, because "Poll now" is manual.
  5. As Bence, the Admin tab isn't shown, and calling `/api/admin/*` returns 403.
- [ ] **Step 2:** `npm run build -w web` exits 0, and `npm test` is green.
- [ ] **Step 3: Commit** `feat(web): admin views and inject event dialog`
- [ ] **Step 4: Milestone gate M3** on `feat/web`.

