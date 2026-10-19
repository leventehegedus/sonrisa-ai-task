# Task 12 report

Status: DONE_WITH_CONCERNS

## Built
- web/src/api.ts: rules CRUD, channels CRUD + test, getMyDeliveries, `errorText` helper ({error, issues} -> one line). web/src/types.ts: Rule, Channel, ScoreBreakdown, MyDelivery etc.
- web/src/components/{ScoreBreakdown,RuleForm}.tsx; web/src/pages/{Rules,Channels,History}.tsx; AppShell renders them (Admin stays placeholder) + Toaster.
- Channels: PATCH sends `config` only from the "Replace webhook"/"Change address" input (R-018); toggle sends only `{enabled}`.
- Fixes: UserSwitcher `value={users.length ? String(userId) : ''}`; AppShell resets stored tab to 'alerts' when Admin vanishes (setState during render, no effect).
- web/src/test-setup.ts + vitest.config.ts setupFiles: shared jsdom polyfills (pointer capture, scrollIntoView, matchMedia, ResizeObserver; sonner/slider need them). Removed the per-file beforeAll from AppShell.test.
- shadcn added: input label checkbox slider switch table sonner (all but input/table/sonner/card import radix-ui; those are plain markup / sonner lib).

## TDD
RED (stub returning null): 3 ScoreBreakdown tests fail with "Unable to find an element with the text: /0\.70 × 0\.75 \(subregion\) = 0\.53/", "< 0.5", "critical override". GREEN after implementing.
RED for placeholder fix (reverted to String(userId)): "AssertionError: expected '' to be 'Select user'"; GREEN with the fix. The tab-reset test was not separately run RED.
Page tests (web/src/pages/pages.test.tsx, 9 tests): keyword trim/drop-empty body, inline error+issues, masked config display, enabled-only PATCH, config PATCH after typing, Slack add with issues, test toast ok/fail, History row + breakdown. Written alongside the implementation, so no separate RED.

## Output
- `npm test`: server 13 files / 215 tests passed; web 4 files / 17 tests passed.
- `npm run build -w web`: built OK (only the >500 kB chunk warning).
- oxlint: no warnings in my new files.

## Real check
Appended to docs/evidence/m3-web-connection.md: rule threshold 0.3 as Bence, email channel, POST test -> {"ok":true} and an outbox file (deleted afterwards), masked Slack PATCH rejected. Processes stopped.

## Concerns
- Browser UI not driven manually; coverage is jsdom tests + curl through the Vite proxy.
- Email PATCH "Change address" sends `{to}` (no secret, but same typed-only rule).
- `POST /channels/:id/test` fails if sent with content-type json and empty body; the RTK mutation sends no body so it is fine.
- Plan/spec defects: none. Brief said App.tsx top nav; kept the existing AppShell tabs per controller instruction.
