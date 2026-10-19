### Task 12: User pages: My alerts, Channels, History

> **Amended 2026-10-19 (D-025):** this task adds its own RTK Query endpoints to `web/src/api.ts`: rules CRUD, channels CRUD + test, my deliveries. Pages render inside the 11c tab panels. The channel PATCH sends `config` only when the user typed a new one (R-018). Error bodies are `{ error, issues? }`.

**Files:**
- Create: `web/src/App.tsx` (top nav: My alerts · Channels · History · Admin (admins only); a `react-router` v7 or state-based tabs, executor's choice, logged), `web/src/pages/{Rules,Channels,History}.tsx`, `web/src/components/{RuleForm,ScoreBreakdown}.tsx`
- Test: `web/src/components/ScoreBreakdown.test.tsx` (`@testing-library/react`)

**Interfaces:**
- `ScoreBreakdown({ b }: { b: ScoreBreakdown })` renders `severity × proximity (reason) = importance`, `≥ threshold` or `< threshold`, and a `critical override` badge when `b.override`. The server type is duplicated in `web/src/types.ts`. `// shortcut: duplicated types, extract a shared package if they drift`.
- `RuleForm`: name, category checkboxes, keywords as comma-separated input, a threshold `Slider` (0–1, step 0.05, value shown), and channel checkboxes. API `400` issues are shown inline.
- Channels page: list with masked config, add email or Slack (type select plus fields), enable switch, and a "Send test" button showing a toast with `ok`/`error`.
- History: a table of my deliveries (time, title, category, country, status, `ScoreBreakdown`).

- [ ] **Step 1: Write the failing test:** `ScoreBreakdown` with the override case shows `critical override`, and the normal case shows `0.53` and `≥ 0.5`.
- [ ] **Step 2–4:** Fail → implement → pass. `npm run build -w web` exits 0.
- [ ] **Step 5: Manual check** with both servers running:
  1. As Bence, create a rule with threshold 0.3.
  2. Add an email channel and click "Send test". A file appears in `data/outbox/`.
- [ ] **Step 6: Commit** `feat(web): user rules, channels, history pages`

