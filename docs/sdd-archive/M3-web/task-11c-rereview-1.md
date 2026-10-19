# Task 11c re-review 1 (fix base 4213c6a, head 43c9e28)

## Finding Verdicts

1. [Important] Blank panel after Admin -> non-admin switch: **ADDRESSED**
   - `web/src/components/AppShell.tsx:17` `useState('alerts')`, `:19` derived `active` falls back to `'alerts'` when the stored tab is not in `visible`, `:49` `<Tabs value={active} onValueChange={setTab}>`.
   - Test `web/src/components/AppShell.test.tsx:77-88` selects Admin, switches to Bela, asserts the Admin tab is gone, `My alerts` has `aria-selected="true"`, and the single tabpanel reads `Coming in Task 12`. The report records a RED run (`aria-selected` `false` vs `true`) before the fix, so the test does guard the bug.

2. [Minor] Switcher trigger blank while loading: **NOT ADDRESSED**
   - `web/src/components/UserSwitcher.tsx:15` `<SelectValue placeholder="Select user" />`. The placeholder is dead for this value.
   - Cause (verified in `node_modules/@radix-ui/react-select` 2.4.1, `dist/index.mjs:1206-1208`): `shouldShowPlaceholder` returns true only for `""` or `undefined`. `UserSwitcher.tsx:13` always passes `String(userId)` (e.g. `"1"`), so the placeholder never renders. While `users` is `[]`, the trigger stays empty, same as before the fix.
   - No test covers it. Suggested fix (one line, not applied): give `SelectValue` children, which Radix shows whenever the value is set, e.g. `<SelectValue>{users.find((u) => u.id === userId)?.name ?? 'Select user'}</SelectValue>`. Alternatively pass `value={users.length ? String(userId) : ''}`.

## New Breakage

- No render loop. `active` is derived during render, with no effect and no setState in render. Tab clicks still go through Radix `onValueChange` -> `setTab`, so normal clicking and keyboard arrow navigation work.
- Minor side effect (not a blocker): `tab` is never reset. If the user is on Admin, switches to a non-admin, then back to an admin, the Admin tab reappears selected because the stored `'admin'` value is used again. Not blank, but not "My alerts" either. Optional fix: also `setTab('alerts')` when the fallback applies, or reset in an effect keyed on `me?.isAdmin`.
- During the refetch after `switchUser` (`me` is cleared), `visible` is the non-admin list, so `active` shows My alerts briefly. Expected and harmless.
- Tests were not re-run in this review (read-only, static review). Results rely on the report's GREEN claim: web 5/5, root server 215/215, `npm run build -w web` OK.

## Verdict

**Needs one small fix.** Finding 1 is properly fixed and tested. Finding 2 is NOT addressed: the placeholder cannot show because `value` is always a non-empty string, so the loading-blank trigger remains. Fix Finding 2 (children-based `SelectValue` or the `value` ternary) and add an assertion on the trigger text. The stale-tab resurrection is optional.
