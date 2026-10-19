# Re-review: fix round 1 (a1ae670..b63201c)

## Verdicts
1. ADDRESSED. Body is now `{me ? <Tabs/> : <p>{error ? 'Could not load your session.' : 'Loading…'}</p>}` at web/src/components/AppShell.tsx:57-74 (error branch at :73). Not `!me && !error`. Test added at web/src/components/AppShell.test.tsx:108-119: /me returns 500, asserts "Could not load your session." is shown and "Loading…" is absent (:117-118). Test run: 7/7 passed in AppShell.test.tsx.
2. ADDRESSED. `git diff ad51de4 -- web/src/components/AppShell.tsx` shows only the logic change (+17/-12 in the body, plus the `{/* ... */}` comment and the reindent of the Tabs block). Single quotes and no semicolons restored at AppShell.tsx:1-35. The a1ae670 churn is reverted in b63201c.

Would the new test fail on pre-fix code? Yes. Pre-fix body was `!me ? <p>Loading…</p> : <Tabs/>`. With /me returning 500, RTK leaves `me` undefined and `error` set, so pre-fix renders "Loading…" forever. `findByText('Could not load your session.')` finds nothing and times out after the default 1000ms, so the test fails. The `queryByText('Loading…')` assertion would also fail. The fetch stub is restored by the file's afterEach (`vi.unstubAllGlobals`), so it does not leak into the following test. No retry is configured on fetchBaseQuery (web/src/api.ts:9), so the 500 resolves immediately and the test is not timing-dependent. I did not run the pre-fix code to prove this; the reasoning is from the code.

## New Breakage
None found. Tab-mount behavior is unchanged from pre-fix: Tabs are unmounted whenever `me` is undefined, as before. The `active` logic is untouched. The only new UI string is the error message, which only shows when `me` is undefined and `error` is set. Test file sets up and tears down its own fetch stub.

## Verdict
Both findings ADDRESSED. The fix is correct and the new test is meaningful. Clean to merge from a review standpoint. Tree is clean (`git status` empty).
