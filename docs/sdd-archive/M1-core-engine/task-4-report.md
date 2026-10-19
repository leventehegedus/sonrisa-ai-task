# Task 4 report: Source adapters

**Status:** DONE. Commit `609d5a4` `feat(server): gdacs, rss, coingecko, manual source adapters` (trailer: Claude Opus 5.5).

## What I built
- `server/src/sources/index.ts`: the `SourceAdapter<C>` interface and `sourceAdapters` = `{ gdacs, rss, coingecko }`.
- `rss.ts`: the RSS adapter plus shared helpers that gdacs also uses: `parseRssItems` (fast-xml-parser with `ignoreAttributes:false`, `parseTagValue:false`, `isArray` for `rss.channel.item`; throws `<label>: no rss.channel in body`), `text()` (handles both the string and the `{'#text'}` node shapes, e.g. the bbc `<guid isPermaLink>`), `cleanText()` (regex tag strip, named and numeric/hex entity decode, whitespace collapse, empty → null; carries the `shortcut:` comment), and `isoDate()` (falls back to `now` when the date is missing or invalid). Config is validated by zod: `country` must pass `lookupCountry`, or be null for global. Breaking keywords are matched as case-insensitive substrings with `toLocaleLowerCase('hu')`, so there is no regex. Severity is 0.5, or 0.8 for a breaking match, with the news `shortcut:` comment. externalId is `guid`, else `link`, else `title`.
- `gdacs.ts`: externalId is `<eventid>:<alertlevel>`. Severity is Green 0.3, Orange 0.7, Red 1.0. iso3 goes through `iso3ToIso2`; an empty or unmapped value gives `scope:'unknown'` and `country:null`. An item with no eventid or an unknown alert level makes the whole normalize call throw, so no partial batch is produced.
- `coingecko.ts`: config defaults are `['bitcoin','ethereum']` and `3`, and coin ids are restricted to `[a-z0-9-]`. The body goes through JSON.parse and then a zod record check; both throw descriptive errors. An event is emitted only when `|chg| >= minChangePct`. severity = `min(1,|chg|/6)`, externalId = `coin:YYYY-MM-DD` (UTC date of `now`), and the title looks like `Bitcoin -6.0% in 24h`.
- `manual.ts`: the `ManualEventInput` zod schema (category enum, non-empty trimmed title, optional summary, optional url via `z.url()`, optional country checked with `lookupCountry`, severity 0..1). `manualEvent()` sets externalId to `manual:<uuid>`. With no country, scope is `global`.

## Tests (`server/test/sources.test.ts`, 24 tests)
These cover everything the brief lists. I also added tests for the hvg count (60), the bbc count (26), a single-item feed, HTML and entity stripping, empty summary → null, a bad pubDate → now, an unknown rss country being rejected, the coingecko defaults and url, manual events, and the four manual-input rejections.

**RED** (stubs: normalize returns `[]`, config schemas are `z.any()`, `manualEvent` throws). Result: 22 failed, 2 passed. Some of the failures:
- `returns 225 disaster events`: `AssertionError: expected [] to have a length of 225 but got +0`
- `maps the first item`: `expected undefined to match object { externalId: '1572503:Green', …(3) }`
- `empty iso3 → scope unknown`: `expected [] to have a length of 3 but got +0`
- `telex (HU)…`: `expected [] to have a length of 50 but got +0`
- `BTC -6 → severity 1…`: `expected [] to have a length of 2 but got +0`
- `gdacs throws` / `coingecko throws`: `expected [Function] to throw an error`
- `rejects {"category":"news","title":"X","severity":1.5}`: `expected true to be false`

The 2 tests that passed under the stubs were `gdacs url` (the stub already returned the real URL) and `fixture → 0 events` (an empty array is trivially correct). My first stub made normalize throw, which crashed collection because gdacs normalize runs at describe level. Switching to the `[]` stub got the assertions collected, as R-P9 requires.

**GREEN:** `Tests 24 passed (24)`. Full server suite: `Test Files 5 passed (5), Tests 64 passed (64)`. `npm run typecheck -w server` passes with no output.

## Fixture counts
I recounted from the fixtures and every count in the brief matches. gdacs: 225 items, Green 219, Orange 5, Red 1, 3 self-closing `<gdacs:iso3 />`, and all 222 non-empty iso3 values map to ISO2. telex: 50 items, 0 `<guid>`. bbcworld: 26 items. hvg: 60 items. coingecko: +1.04 / +1.26.

## Self-review
- After my first draft I simplified the entity decoding into one numeric path, and added a guard so a code point above U+10FFFF is left as-is instead of `fromCodePoint` throwing a RangeError.
- fast-xml-parser decodes XML entities itself, and `cleanText` then decodes once more. Double-encoded RSS text such as `&amp;amp;` therefore becomes `&`. I intended this, and the test covers it.
- `gdacs.configSchema` and `coingecko.configSchema` are cast to `z.ZodType<C>`. Zod's input and output types differ here (`.strict()` gives `{}`, `.default()` makes fields optional on input).

## Plan/spec defects
None found. All brief counts match the fixtures.

## Concerns
- The none of the fixtures contain HTML in their descriptions (bbc uses plain-text CDATA), so the "summary has no HTML" check against the fixtures passes trivially. The real strip and decode path is exercised by an inline test body instead.
- coingecko: if any coin in the body lacks a numeric `usd_24h_change` (CoinGecko can return null for it), the whole body is rejected. That is consistent with "no partial events", but if it happens it shows up as a source error, not as a skipped coin.
- A breaking-keyword test on telex uses `ZAVARGÁS`, which depends on the fixture containing that word (it does).

## Fix round 1 (commit `37a2332`)

**Changes**
1. `gdacs.ts`: severity lookup is now `Object.hasOwn(SEVERITY, level) ? SEVERITY[level] : undefined`. A level such as `constructor` or `toString` no longer resolves through the prototype. Unknown and missing levels throw `gdacs: item missing eventid or unknown alertlevel '<level>'`.
2. URLs are http/https only.
   - `ManualEventInput.url` and the RSS config `url` now use `z.url({ protocol: /^https?$/ })`.
   - New helper `httpUrl()` in `rss.ts`. A non-http(s) item `<link>` gives `event.url = null` while still being usable as the externalId. I applied this to GDACS item links as well, for consistency. The reviewer did not ask for that, but it is the same risk.
3. `rss.ts`: normalize now uses `flatMap`. The id is guid → link → cleaned title, each trimmed. If all are empty, the item is skipped.

**New tests (10)**
- gdacs: unknown alertlevel `constructor`, `toString` and `Purple` each throw. A missing alertlevel throws. A `javascript:` link gives `url: null`.
- rss: `javascript:` and `file:` item links give `url: null` but remain the ids. In an inline body with 3 items, the item with no ids and the item with blank ids are skipped, and the title-only item is kept with id = title. Config rejects `file:///etc/passwd` and `javascript:alert(1)` and accepts `http://`.
- manual: rejects `javascript:` and `file:` urls, accepts both http and https.

**RED** (src stashed, new tests kept): `Tests 8 failed | 26 passed (34)`. Failures include:
- `unknown alertlevel constructor throws`: `expected [Function] to throw an error`
- `non-http(s) item link → url null`: `expected [ 'javascript:alert(1)', …(1) ] to deeply equal [ null, null ]`
- `item with no guid, link or title is skipped`: `expected [ Array(3) ] to have a length of 1 but got 3`
- `rejects {..."url":"javascript:alert(1)"}`: `expected true to be false`

`Purple` and missing-level already threw before the fix. The tests were added as regression guards.

**GREEN**
- `cd server && npx vitest run test/sources.test.ts`: `Tests 34 passed (34)`
- Full suite (`npx vitest run`): `Test Files 5 passed (5), Tests 74 passed (74)`
- `npm run typecheck -w server`: `tsc --noEmit`, clean.
