### Task 2: Geo lookup and importance scoring

**Files:**
- Create: `server/src/geo/m49.csv` (copied from the evidence file), `server/src/geo/index.ts`, `server/src/scoring/weights.ts`, `server/src/scoring/index.ts`
- Test: `server/test/scoring.test.ts`, `server/test/geo.test.ts`

**Interfaces:**
- Produces: `lookupCountry(iso2: string): { iso2: string; iso3: string; region: string; subregion: string } | undefined` and `iso3ToIso2(iso3: string): string | undefined`. The CSV is parsed once at module load: split on lines, and handle quoted fields with commas such as `"Korea, Republic of"`. Use a tiny CSV split, not a library.
- Produces: `WEIGHTS` (the constants from Global Constraints) and `DEFAULT_THRESHOLD = 0.5`.
- Produces: `proximity(event: Pick<NewEvent,'scope'|'country'>, homeCountry: string): { weight: number; reason: ProximityReason }` and `score(event: Pick<NewEvent,'scope'|'country'|'severity'>, homeCountry: string, threshold: number): ScoreBreakdown`.

- [ ] **Step 1: Write the failing tests.**
  - `geo.test.ts`: `lookupCountry('HU')` → `{iso3:'HUN', region:'Europe', subregion:'Eastern Europe'}`. `AT` → `Western Europe`. `RO` → `Eastern Europe`. `NP` → `Asia`/`Southern Asia`. `iso3ToIso2('VUT') === 'VU'`. `lookupCountry('KR')` is defined (a quoted CSV name). `lookupCountry('XK')` is `undefined`.
  - `scoring.test.ts`: `it.each` over the **12 rows of design §8**, with home `HU` and threshold `0.5`. Assert `importance` (with `toBeCloseTo(x, 3)`), `proximityReason`, `override` and `fires` for each. Inputs: HU news (country HU, 0.5); NP news 0.5; NP breaking 0.8; global 0.5; global 0.8; NP 1.0; RO 0.7; ES 0.7; unknown 0.7; global `0.5`; global `4/6`; global `1.0`. Plus: event country `XK` with home `HU` → `elsewhere`, and event country `XK` with home `XK` → `home`.
- [ ] **Step 2:** Run `npm test -w server -- scoring geo`. Expected: FAIL.
- [ ] **Step 3:** Implement. The override rule: `importance = severity >= 0.9 ? Math.max(severity*weight, severity) : severity*weight`. `fires = importance >= threshold - 1e-9`.
- [ ] **Step 4:** Run. Expected: PASS (13 scoring cases plus the geo cases).
- [ ] **Step 5: Commit** `feat(server): M49 geo lookup and region-weighted scoring`

