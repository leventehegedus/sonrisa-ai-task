Task 11a: minor (deferred): unused lucide-react (shadcn iconLibrary default); root typecheck covers server only; loading/error UI not viewed in a browser; root package.json reformatted
Ruling: live checks must not touch the user's running instance (:3000/:5173, data/alerts.db) — use PORT=3001 for the API and vite --port 5174 with a configurable proxy target (env API_TARGET, default http://localhost:3000) — added to Task 11c — cost if wrong: one env var
Task 11b: Ruling: baseUrl `${location.origin}/api` accepted (Node undici Request rejects relative URLs; jsdom url option doesn't help per reviewer) — cost if wrong: split-origin deploy needs configurable base (non-goal)
Task 11b: minor (deferred): no tests for localStorage fallbacks / getUsers / /users 401; load() accepts any positive int (e.g. 999 → 401 page)
Task 11b: minor → folded into 11c: `switchUser(2) as never` typing gap — type the thunk against AppDispatch
Ruling: placeholder fix + stale-tab reset folded into Task 12 dispatch (Minor; saves a round per D-024) — cost if wrong: brief blank trigger until Task 12
Task 12: minor (deferred): no tests for threshold Slider / editing existing rule; delete has no confirm; MyDeliveries never invalidated (fine)
Task 12: minor → folded into Task 13: admin→admin switch bounces to My alerts while me is undefined after resetApiState (guard fallback with `me &&`)
Task 13: minor (deferred): source Switch has no error handling; interval no client guard (cleared → 0 → server 400 shown as toast); inject dialog error not cleared on close; no Deliveries status-filter test; /me failure leaves admin tab blank
