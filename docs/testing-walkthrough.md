# Testing Walkthrough and Requirements Checklist

A step-by-step guide to trying the finished app in the browser, followed by a checklist of the assignment's requirements, each mapped to where it's met. For curl-level API testing, see [`how-to-test.md`](how-to-test.md). For the goal-by-goal proof, see [`verification.md`](verification.md).

---

## Part A — Step-by-step test

### 0. Prerequisites
- Node 24 (`node --version`)
- A terminal at the repo root

### 1. Install and run the automated checks (about 1 min)
```bash
npm install
npm test                       # server: 215 passed · web: 25 passed
npm run build -w web           # builds without errors
npx playwright install chromium   # first time only
npm run e2e                    # 1 passed; writes 6 screenshots to docs/evidence/screenshots/e2e/
```
`npm run e2e` starts its own API (:3002) and web app (:5175) with a throwaway database, so it doesn't touch your data.

### 2. Start the app from a clean state
```bash
rm -rf data/        # optional: start fresh
npm run dev         # API on :3000 and web on :5173 together
```
Open **http://localhost:5173**.

When the database is empty, the server seeds three users, each with an email channel and a "Default" rule (all categories, threshold 0.5):

| User | Home | Role |
|---|---|---|
| Anna | HU | admin |
| Bence | HU | user |
| Priya | NP | user |

It also starts polling 5 live sources (GDACS, CoinGecko, Telex, HVG, BBC World). The first poll is only a baseline, so you won't get alerts for news that already exists.

### 3. The shell
- [ ] The header shows **World Alerts**, then **Anna (HU)** with an **admin** badge and the user dropdown.
- [ ] The tabs are **My alerts · Channels · History · Admin**.
- [ ] **My alerts** lists the rule **Default** (threshold 0.50).

### 4. Admin: sources are live
1. Click **Admin**, then **Sources**.
2. Check:
   - [ ] 5 sources are listed. **Last polled** has a time, and **Last error** is empty (or shows a readable reason if your network blocks a feed).
   - [ ] **Poll now** on one source shows a toast like `Telex: 0 new events`.
   - [ ] **Admin → Events** shows the real events stored by the baseline poll.

### 5. Admin: region-weighted alerts (the core logic)
Use **Inject event** (in the Admin view). Leave URL and Summary empty. Each time, check the toast **"N deliveries created"**.

| # | Category | Title | Country | Severity | Expected toast | Why |
|---|---|---|---|---|---|---|
| a | disaster | Flood in Budapest | `HU` | 0.60 | **2** | Anna and Bence are home (×1.0) → 0.60 ≥ 0.5; Priya: 0.6 × 0.2 = 0.12 |
| b | disaster | Flood in Romania | `RO` | 0.70 | **2** | RO is in the same UN sub-region as HU (×0.75) → 0.525 |
| c | disaster | Flood in Spain | `ES` | 0.70 | **0** | same continent only (×0.4) → 0.28 |
| d | disaster | Major earthquake in Nepal | `NP` | 1.00 | **3** | **critical override**: severity ≥ 0.9 reaches everyone |
| e | market | BTC moves | *(blank)* | 0.70 | **3** | global (×0.8) → 0.56 for everyone |

Then open **Admin → Deliveries**:
- [ ] The rows show **User**, **Event**, **Status** and **Why**.
- [ ] **Why** reads like `0.60 × 1.00 (home) = 0.60 ≥ 0.5`.
- [ ] Row d shows a **critical override** badge.
- [ ] The status goes from `pending` to `sent` within about 10 s. Switch tabs or reload to refresh the list.
- [ ] `ls data/outbox/` shows one JSON "email" per delivery.

### 6. User view: history, rules, channels
1. **Switch the user dropdown to Priya**:
   - [ ] The **Admin** tab disappears.
   - [ ] **History** shows only rows d and e, with their **Why** text.
2. **Switch to Bence**, then go to **History**:
   - [ ] He has a, b, d and e (no c).
3. As Bence, go to **My alerts** and click **New rule**:
   - Name: `Quakes`
   - Categories: **disaster**
   - Keywords: `earthquake`
   - Threshold: **0.30**
   - Channels: tick his email channel
   - Save.
   - [ ] The rule appears in the list.
   - [ ] **Edit** and **Delete** work.
4. Validation:
   - [ ] A rule with an empty name shows an inline error and nothing is saved.
5. As Bence, open **Channels**:
   - [ ] His **email** channel is listed.
   - [ ] **Send test** shows the toast **Test sent**, and a new file appears in `data/outbox/`.
   - [ ] **Add channel → slack** with an invalid URL (`http://example.com`) is rejected.

### 7. Access control
- [ ] As Bence or Priya there's no Admin tab, and the API refuses admin calls:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin/users -H 'X-User-Id: 2'   # 403
  curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/me                              # 401
  ```
- Identity is the dev user switcher (`X-User-Id` header). It's a stated shortcut, **not** real authentication.

### 8. Optional: the failure and retry path
1. Restart with a fake Slack webhook, so sends fail for real:
   ```bash
   rm -rf data/
   SEED_SLACK_WEBHOOK='https://hooks.slack.com/services/T000/B000/XXXX' SLACK_DRY_RUN=0 npm run dev
   ```
2. As Anna, inject a `HU` 0.6 event. Bence's Slack delivery fails: Slack rejects the fake token.
3. In **Admin → Deliveries**, filter by **failed**. It retries after 30 s, then 60 s, then becomes `failed` after 3 attempts (about 1.5 min).
4. Check:
   - [ ] **Last error** shows `Slack responded 4xx`, and the webhook URL is **not** shown.
   - [ ] **Retry** puts it back to `pending`. It will fail again, which is expected with a fake webhook.
- With a **real** Incoming Webhook URL, the same steps deliver to Slack. This hasn't been verified yet.

### 9. Reset
Stop with Ctrl+C. `rm -rf data/` removes the database and the outbox.

---

## Part B — Assignment requirements checklist

Sources: [`task-brief.md`](task-brief.md) (the assignment) and the PM brief quoted in it.

### B1. What the PM brief asks the product to do

| Requirement (PM brief) | Status | Where / how to check |
|---|---|---|
| Users can **set up alerts** | ✅ | My alerts tab (rules: categories, keywords, threshold, channels) · Part A §6 |
| Notified when **something important happens** | ✅ | Region-weighted score + critical override; every alert shows *why* · Part A §5 · design §8 |
| **Breaking news, market movements, natural disasters** | ✅ | RSS (telex, hvg, BBC) · CoinGecko (BTC/ETH) · GDACS (quakes, floods, cyclones, fires, droughts) · Admin → Sources |
| Works for **email** | ✅ | Email adapter: JSON outbox by default, real SMTP via `SMTP_URL` / `.env`. **Real Gmail delivery verified 2026-10-20** (see verification.md) · Part A §5–6 |
| Works for **Slack** | ✅ | Slack adapter with timeout, escaping and masking. **Real delivery verified 2026-10-20**: Slack accepted the post and the user confirmed it arrived (see verification.md) |
| **Flexible: more channels later** | ✅ (design) | `ChannelAdapter` interface + registry: one file plus one line; no DB constraint on type · design §10 · verification marks it "partial" (no third adapter written) |
| **Admin view** | ✅ | Admin tab: Users, Rules, Events, Deliveries (+ retry, breakdown), Sources (toggle, interval, poll now), Inject event |

### B2. What the assignment asks you to submit

| Requirement (task brief) | Status | Evidence |
|---|---|---|
| **GitHub repository** | ❌ **not pushed yet** | `origin` = `github.com/leventehegedus/sonrisa-ai-task`, but local `main` is **ahead by 60 commits**. Needs `git push origin main` (plus feature branches if wanted) |
| **Commits for each major milestone**, meaningful messages | ✅ | 61 commits: Conventional Commits plus a `--no-ff` merge per milestone (`planning/initial-plan`, `feat/core-engine`, `fix/poll-baseline`, `feat/api`, `feat/web`, `fix/appshell-tab-flake`, `chore/e2e-evidence`) |
| **Prompt history: all prompts** | ✅ | [`prompts/`](../prompts/): every prompt verbatim with outcome, decisions and commit hash |
| **Plans** | ✅ | [`plan.md`](plan.md) (plan of attack: deliverables, order, why) · [`superpowers/plans/…`](superpowers/plans/2026-10-19-world-alerts.md) (TDD tasks) |
| **Design docs** | ✅ | [`superpowers/specs/…-design.md`](superpowers/specs/2026-10-19-world-alerts-design.md) (approved by the user, builder-checked, amended with reasons) |
| **Decision logs** | ✅ | [`decisions.md`](decisions.md): D-001..D-026, with your calls vs the agent's calls marked |
| **Evidence of validating AI output** (assumptions challenged, hallucinations caught, code rejected) | ✅ | [`ai-review-log.md`](ai-review-log.md): R-001..R-023 (wrong claims, rejected data sources, a non-M49 dataset, flawed weights, security gaps, a flaky test, the agent's own wrong statements) |
| **Intermediate outputs, notes, scratch, screenshots** | ✅ | [`sdd-archive/`](sdd-archive/) (every brief, report, review and diff per task) · [`evidence/`](evidence/) (feed probes, M49 check, smoke runs, screenshots) |
| **Deliverables as defined by your own plan** | ✅ | All of plan.md §3 delivered (M1–M4 merged) · [`progress-summary.md`](progress-summary.md) §5 |
| **Plan of attack defined before building** | ✅ | brainstorming (prompts 002–009) → spec → plan, all before code (M1 started at prompt 010) |
| **Surface checks, rejections, course-corrections** | ✅ | ai-review-log, plus the per-task fix rounds in the sdd-archive ledgers (`progress.md`) |
| **Partial but well-reasoned beats complete but undocumented** | ✅ | Every "not verified" item is listed honestly in [`verification.md`](verification.md) |

### B3. Open items before submitting
1. **Push to GitHub.** This is the only hard blocker.
2. ~~Optional: verify real Slack.~~ Done: verified 2026-10-20.
3. ~~Optional: real SMTP send.~~ Done: real Gmail delivery verified 2026-10-20.
