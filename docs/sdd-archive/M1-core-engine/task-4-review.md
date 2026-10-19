### Spec Compliance
- ✅ Spec compliant. Every item in the brief and in the controller clarifications is met: the GDACS map and `<eventid>:<alertlevel>` (gdacs.ts:7,22), guid → link fallback with object guids handled (rss.ts:29-33,75), single `<item>` → array (rss.ts:12), tag strip plus entity decode with empty → null (rss.ts:38-50), a descriptive throw when there is no `rss.channel` (rss.ts:24) and on bad JSON or bad shape (coingecko.ts:19-25), pubDate → ISO with a `now` fallback (rss.ts:52-55), coingecko `min(1,|chg|/6)`, `abs >= minChangePct`, a UTC `coin:YYYY-MM-DD` id and the `Bitcoin -6.0% in 24h` title (coingecko.ts:26-41), manual ISO2 + 0..1 validation and `manual:<uuid>` (manual.ts:6-19), and both `shortcut:` comments in the required format (rss.ts:37,82). Nothing extra beyond small, justified config validation.
- ⚠️ Cannot verify from diff: that the test and typecheck runs are green (I took the report's numbers as given and did not re-run the suite). Fixture byte-identity was verified by the controller.

Named-risk checks:
1. GDACS unknown level: a missing or empty level, or a lowercase one, throws. **But** a level that matches an `Object.prototype` key gets past the guard (see Important #1).
2. RSS keywords: a case-insensitive substring match with `toLocaleLowerCase('hu')` and no RegExp (rss.ts:57,70,74). ✅
3. coingecko: `now.toISOString().slice(0,10)` is UTC and the threshold uses `Math.abs(...) < min → skip` (coingecko.ts:26,30). ✅
4. manual: `lookupCountry` is an exact, case-sensitive `Map.get` (geo/index.ts:30), so `XX` and `hu` are rejected, and severity is `.min(0).max(1)`. ✅

### Strengths
- Shared RSS helpers (`parseRssItems`, `text`, `cleanText`, `isoDate`) are reused by gdacs with no duplication. `parseTagValue:false` keeps ids as strings, which is a good catch.
- No partial batches: one bad item makes the whole `normalize` call throw, as the ruling requires.
- Config schemas validate the RSS country and coin-id charset, so the coingecko URL can't be injected into.
- The tests hit the real fixtures with exact counts (225/219/5/1/3, 50, 26, 60) and include an inline single-item, entity-decoding, empty-summary and bad-date case. RED evidence follows R-P9 (the tests were collected and the assertions failed).
- `fromCodePoint` is guarded against code points above U+10FFFF.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **gdacs.ts:7,17-18: `SEVERITY[level]` reads through the prototype, so the unknown-level guard can be bypassed (named risk 1).** `SEVERITY` is a plain object literal. An alert level such as `constructor`, `toString` or `valueOf` returns a function, not `undefined`, so `severity === undefined` is false and the item is emitted. I reproduced this: an item with `<gdacs:alertlevel>constructor</gdacs:alertlevel>` produced `typeof severity === 'function'` with no throw. GDACS is very unlikely to send those strings, but this guard is the only thing stopping a non-numeric severity from reaching scoring and the DB. Fix: `const severity = Object.hasOwn(SEVERITY, level) ? SEVERITY[level] : undefined` (or use a `Map`). Add a test that an unknown or missing alert level throws, because that path is currently untested.

#### Minor (Nice to Have)
1. **manual.ts:10 and rss.ts:64: `z.url()` accepts any scheme.** I checked that `javascript:alert(1)` passes `ManualEventInput` and `file:///etc/passwd` passes the RSS config. The manual `url` is later rendered as a link in the UI and in emails. It is admin-only, but restricting it to `http(s)` is cheap (`z.url({ protocol: /^https?$/ })`). Task 9 may also cover this.
2. **rss.ts:40-45: double-encoded HTML becomes real tags.** Tags are stripped before entities are decoded, so `&amp;lt;script&amp;gt;` comes out as the summary `<script>x</script>` (reproduced). The `shortcut:` comment covers rendering, and React escapes text, but the brief says "summary has no HTML tags". A second strip pass after decoding would close this.
3. **rss.ts:24: a valid but empty `<rss><channel></channel></rss>` throws** (`no rss.channel in body`), because the parser yields `''`. A feed with zero items would show up as a source error. This is rare, since real channels always have a `<title>`.
4. **rss.ts:75: externalId can be `''`** when an item has no guid, link or title (reproduced). All such items would then collide on `UNIQUE(source, external_id)`. Throw instead, consistent with the no-partial rule.
5. **coingecko.ts:30: a configured coin missing from the body is silently skipped**, while a coin with a null `usd_24h_change` rejects the whole body (the report flags the latter). That asymmetry is acceptable, but at least worth a comment.
6. **Test coverage (sources.test.ts):** `now` is 18:00Z, so a local-time date bug would not be caught (a `23:30Z` case would catch it). There is no boundary test at exactly `minChangePct` (`3` → emitted, `-2.99` → not). The "summary has no HTML" fixture assertion passes trivially, as the report admits, and the inline test covers it instead.

### Assessment
**Task quality:** Needs fixes
**Reasoning:** The adapters are correct, well-factored and thoroughly tested against the real fixtures. The one fix needed is the GDACS severity lookup: the prototype-key hole defeats the exact "unknown level must not become a severity" guard the controller named, and it takes a one-line `Object.hasOwn` fix plus a test. The rest is polish.
