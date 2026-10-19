### Task 14: End-to-end evidence and README

**Files:**
- Create: `e2e/screenshots.spec.ts`, `playwright.config.ts` (`webServer` runs `npm run dev`, with `DB_PATH=data/e2e.db` deleted before the run), `docs/evidence/screenshots/*.png`, `docs/verification.md`
- Modify: `README.md` (what it is, quick start: `npm install && npm run dev`, then open http://localhost:5173; env vars `SMTP_URL`, `SLACK_DRY_RUN`, `SEED_SLACK_WEBHOOK`, `PORT`, `DB_PATH`; architecture diagram; links to docs and prompts)

- [ ] **Step 1:** The Playwright spec walks through the Task 13 manual check (inject HU 0.6, then NP 1.0, then check the Deliveries rows) and saves screenshots of: My alerts, Channels, History, Admin Deliveries with breakdowns, Admin Sources, and the inject dialog. Run with `npx playwright test`. Expected: pass, and 6 PNGs.
- [ ] **Step 2:** If a real Slack webhook is available, set `SEED_SLACK_WEBHOOK` and `SLACK_DRY_RUN=0`, inject a critical event, and screenshot the Slack message. If not, record in `docs/verification.md` that Slack was verified in dry-run mode only. **Don't claim a real delivery that didn't happen.**
- [ ] **Step 3:** `docs/verification.md`: a table of each spec goal (§2) → how it was verified (test name, screenshot or command output) → result. List what was **not** verified.
- [ ] **Step 4: Commit** `chore: e2e screenshots, verification report, README`
- [ ] **Step 5: Final gate:** a whole-repo review subagent (`ponytail:ponytail-review` or `superpowers:requesting-code-review`), with its findings triaged. Merge to `main`.
