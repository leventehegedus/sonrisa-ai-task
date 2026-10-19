### Task 4: Source adapters (normalize from real fixtures)

**Files:**
- Create: `server/src/sources/{index,gdacs,rss,coingecko,manual}.ts`, `server/test/fixtures/` (copy `gdacs.xml`, `telex.xml`, `hvg.xml`, `bbcworld.xml`, `coingecko.json` from `docs/evidence/feed-probes-2026-10-19/`)
- Test: `server/test/sources.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SourceAdapter<C> {
    type: 'gdacs' | 'rss' | 'coingecko';
    configSchema: z.ZodType<C>;
    url(config: C): string;
    normalize(body: string, config: C, now: Date): NewEvent[];   // pure; throws on unparseable body
  }
  export const sourceAdapters: Record<SourceAdapter<any>['type'], SourceAdapter<any>>;
  ```
- Configs:
  - gdacs `{}`
  - rss `{ feedId: string; url: string; country: string | null; breakingKeywords: string[] }`. `country: null` → `scope: 'global'`.
  - coingecko `{ coins: string[]; minChangePct: number }` (default `['bitcoin','ethereum']`, `3`)
- Produces: `manualEvent(input: ManualEventInput, now: Date): NewEvent`. `ManualEventInput` is a zod schema with `category`, `title`, `summary?`, `url?`, `country?` (ISO2, validated against `lookupCountry`; absent → `global`), and `severity` (0..1). `externalId = 'manual:' + crypto.randomUUID()`.

- [ ] **Step 1: Write the failing tests** against the fixtures:
  - **gdacs:** returns 225 events, all `category: 'disaster'`. The first item → `externalId: '1572503:Green'`, `country: 'VU'`, `scope: 'country'`, `severity: 0.3`. Severity per level: Green 0.3, Orange 0.7, Red 1.0. Items with an empty `gdacs:iso3` → `scope: 'unknown'`, `country: null`; there are exactly 3 in the fixture. Exactly 1 event has severity 1.0 (Red); 5 have 0.7.
  - **rss (telex, country HU):** 50 events, `scope: 'country'`, `country: 'HU'`, severity 0.5. `externalId` = `<guid>` or else `<link>`. The summary has no HTML tags. A title containing a breaking keyword (case-insensitive) → 0.8.
  - **rss (bbcworld, country null):** `scope: 'global'`.
  - **coingecko** (fixture with BTC +1.04%, ETH +1.26%, `minChangePct: 3`): 0 events. Then an inline body with BTC `-6` → 1 event, severity `1.0`, `scope: 'global'`, `externalId: 'bitcoin:2026-10-19'` (UTC date of `now`), title containing `-6.0%`. ETH `+4` → severity `4/6`.
  - Garbage body (`'<html>oops'`) → `normalize` throws, for gdacs, rss and coingecko alike.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement with `fast-xml-parser` (`ignoreAttributes: false`; read `gdacs:iso3`, `gdacs:alertlevel` and `gdacs:eventid`). Strip HTML with a regex plus entity decoding, and mark it `// shortcut: regex HTML strip, use a sanitizer if summaries are ever rendered as HTML`. News severity gets `// shortcut: RSS has no importance signal, upgrade to LLM scoring (non-goal v1)`.
- [ ] **Step 4:** Run. Expected: PASS. If a count in the fixture doesn't match this plan, **recount from the fixture** before changing the test, and log which one was wrong.
- [ ] **Step 5: Commit** `feat(server): gdacs, rss, coingecko, manual source adapters`

