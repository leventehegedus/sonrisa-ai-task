### Spec Compliance
- ❌ Issues found:
  - Named risk 1 fails: the Admin tab is hidden for non-admins, but there is no fallback when the selected tab is Admin. See Important 1.
- ⚠️ Cannot verify from diff: `tsc -b` passing with the thunk change. `store.ts` is not in the diff, so I did not check that `AppDispatch` accepts `ThunkAction<..., undefined, ...>`. The cast removal in `api.test.ts:26` and the cast-free dispatch in `UserSwitcher.tsx:14` are consistent with it.
- Radix grep: `select.tsx`, `tabs.tsx` and `badge.tsx` all match `radix-ui`.
- Spec items present: header with title, user name, home country and an admin badge; `UserSwitcher` with the shortcut comment; plain tabs with no router; placeholders; `App` renders `AppShell`; the error state with Retry (`AppShell.tsx:25-32`); `API_TARGET` proxy (`vite.config.ts:11`); evidence on :3001/:5174.

### Strengths
- Small, tidy implementation. The tab list is data-driven and the admin gate is one conditional (`AppShell.tsx:14`).
- The thunk typing is fixed at the source (`session.ts`) and the cast is removed from the existing test.
- The switcher test drives the real Radix Select, not a mock. It goes switch, then `resetApiState`, then refetch with the new `X-User-Id`, and then the Admin tab disappears and DE appears (`AppShell.test.tsx:63-75`).
- The polyfills are assigned in `beforeAll` inside the test file only (`:30-34`). Nothing leaks into app code, and vitest isolates modules per file.
- The Badge is used (`AppShell.tsx:21`). Nothing unused was added apart from the generated shadcn files. The real-run evidence respects the user's :3000 instance.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **Blank panel when switching from Admin to a non-admin user** (`AppShell.tsx:38`). `<Tabs defaultValue="alerts">` is uncontrolled. If the admin is on the Admin tab and switches to Bela, the Admin trigger and content are removed but Radix keeps `value="admin"`. No trigger is active and no panel renders, so the content area is blank until the user clicks a tab. `switchUser` also clears `me`, so `visible` drops Admin immediately. This is the named risk and it is untested. Fix: control the tab, for example `const [tab, setTab] = useState('alerts')` and `value={visible.some(t => t.value === tab) ? tab : 'alerts'}` with `onValueChange={setTab}`. Add a test that selects Admin, switches user, and asserts the My alerts panel is shown.

#### Minor (Nice to Have)
1. **Switcher goes blank while users load, and after every switch** (`UserSwitcher.tsx:11,14`). `users` defaults to `[]`, so `value="1"` matches no item. Radix renders an empty `SelectValue` with no crash. `resetApiState` also drops the cached users, so the trigger flickers blank after each switch. The same happens if the stored `userId` is not in the list (the trigger stays blank). It is safe but not sensible. Cheap fix: a `placeholder` on `SelectValue`, or skip rendering the select until `users` is loaded.
2. **No test for the error state** (`AppShell.tsx:25-32`). The controller required a visible error state if `/api/me` fails, and nothing covers it (a mocked 500 would do).
3. **No assertion on the switcher's displayed value.** The tests never check that the trigger shows the current user name.
4. **Two header texts for one user.** `{me.name} ({me.homeCountry})` is rendered next to a switcher that shows the same name. This is acceptable but redundant.
5. **Placeholder text.** The brief says "Coming in Task 12 / 13". The implementer chose 12 for the three user tabs and 13 for Admin, which is reasonable. Confirm it matches the plan.

### Assessment
**Task quality:** Needs fixes
**Reasoning:** The implementation is clean and the tests exercise real switch-and-refetch behaviour. However, switching from the Admin tab to a non-admin user leaves a blank panel, which is exactly the named risk, and no test covers it. Fix that with a controlled tab value plus a test. The rest is minor.
