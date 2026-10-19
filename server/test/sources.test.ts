import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceAdapters } from '../src/sources';
import { manualEvent, ManualEventInput } from '../src/sources/manual';
import { ingest } from '../src/pipeline/ingest';
import { addChannel, addRule, addUser, makeDb } from './helpers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const now = new Date('2026-10-19T18:00:00Z');
const { gdacs, rss, coingecko } = sourceAdapters;
const rssConfig = (over: object = {}) =>
  rss.configSchema.parse({ feedId: 'telex', url: 'https://telex.hu/rss', country: 'HU', breakingKeywords: [], ...over });

describe('gdacs', () => {
  const events = gdacs.normalize(fixture('gdacs.xml'), gdacs.configSchema.parse({}), now);

  it('returns 225 disaster events', () => {
    expect(events).toHaveLength(225);
    expect(events.every((e) => e.category === 'disaster' && e.source === 'gdacs')).toBe(true);
  });

  it('maps the first item', () => {
    expect(events[0]).toMatchObject({ externalId: '1572503:Green', country: 'VU', scope: 'country', severity: 0.3 });
    expect(events[0]!.title).toContain('Vanuatu');
    expect(events[0]!.occurredAt).toBe('2026-10-19T08:09:51.000Z');
  });

  it('maps alert levels to severity', () => {
    expect(events.filter((e) => e.severity === 1.0)).toHaveLength(1);
    expect(events.filter((e) => e.severity === 0.7)).toHaveLength(5);
    expect(events.filter((e) => e.severity === 0.3)).toHaveLength(219);
    expect(events.find((e) => e.severity === 1.0)!.externalId).toMatch(/:Red$/);
  });

  it('empty iso3 → scope unknown, country null (exactly 3)', () => {
    const unknown = events.filter((e) => e.scope === 'unknown');
    expect(unknown).toHaveLength(3);
    expect(unknown.every((e) => e.country === null)).toBe(true);
    expect(events.filter((e) => e.scope === 'country').every((e) => /^[A-Z]{2}$/.test(e.country!))).toBe(true);
  });

  it('url', () => expect(gdacs.url({})).toBe('https://www.gdacs.org/xml/rss.xml'));

  const gdacsItem = (inner: string) =>
    `<rss><channel><item><title>T</title><link>https://www.gdacs.org/x</link><gdacs:eventid>1</gdacs:eventid>${inner}<gdacs:iso3>HUN</gdacs:iso3></item></channel></rss>`;

  it.each(['constructor', 'toString', 'Purple'])('unknown alertlevel %s throws', (level) => {
    expect(() => gdacs.normalize(gdacsItem(`<gdacs:alertlevel>${level}</gdacs:alertlevel>`), {}, now)).toThrow(/alertlevel/);
  });

  it('missing alertlevel throws', () => {
    expect(() => gdacs.normalize(gdacsItem(''), {}, now)).toThrow(/alertlevel/);
  });

  it('non-http item link → url null', () => {
    const body = gdacsItem('<gdacs:alertlevel>Red</gdacs:alertlevel>').replace('https://www.gdacs.org/x', 'javascript:alert(1)');
    expect(gdacs.normalize(body, {}, now)[0]).toMatchObject({ url: null, severity: 1.0, country: 'HU' });
  });
});

describe('rss', () => {
  it('telex (HU): 50 country events at base severity, link as externalId', () => {
    const events = rss.normalize(fixture('telex.xml'), rssConfig(), now);
    expect(events).toHaveLength(50);
    for (const e of events) {
      expect(e).toMatchObject({ source: 'rss:telex', category: 'news', scope: 'country', country: 'HU', severity: 0.5 });
      expect(e.externalId).toMatch(/^https:\/\/telex\.hu\//);
      expect(e.externalId).toBe(e.url);
      expect(e.summary ?? '').not.toMatch(/<[^>]+>/);
    }
    expect(events[0]!.occurredAt).toBe('2026-10-19T17:04:41.000Z');
  });

  it('breaking keyword in title (case-insensitive, accented) → 0.8', () => {
    const events = rss.normalize(fixture('telex.xml'), rssConfig({ breakingKeywords: ['ZAVARGÁS'] }), now);
    const hit = events.filter((e) => e.severity === 0.8);
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.every((e) => e.title.toLocaleLowerCase('hu').includes('zavargás'))).toBe(true);
    expect(events.filter((e) => e.severity === 0.5)).toHaveLength(50 - hit.length);
  });

  it('bbcworld (country null) → global, guid object handled', () => {
    const events = rss.normalize(fixture('bbcworld.xml'), rssConfig({ feedId: 'bbc', country: null }), now);
    expect(events).toHaveLength(26);
    for (const e of events) {
      expect(e).toMatchObject({ source: 'rss:bbc', scope: 'global', country: null });
      expect(typeof e.externalId).toBe('string');
      expect(e.externalId.length).toBeGreaterThan(0);
    }
  });

  it('hvg (HU): 60 events', () => {
    expect(rss.normalize(fixture('hvg.xml'), rssConfig({ feedId: 'hvg' }), now)).toHaveLength(60);
  });

  it('single item, HTML + entities stripped, empty summary → null, bad pubDate → now', () => {
    const body = `<?xml version="1.0"?><rss><channel><item><title>A &amp; B</title><link>https://x.test/1</link>
      <description>&lt;p&gt;Hello &amp;amp; &lt;b&gt;world&lt;/b&gt; &amp;#39;q&amp;#39; &amp;#337;&lt;/p&gt;</description><pubDate>nope</pubDate></item></channel></rss>`;
    const [e, ...rest] = rss.normalize(body, rssConfig(), now);
    expect(rest).toHaveLength(0);
    expect(e).toMatchObject({ title: 'A & B', summary: "Hello & world 'q' ő", occurredAt: now.toISOString() });
    const empty = `<rss><channel><item><title>T</title><link>https://x.test/2</link><description>&lt;br/&gt;</description></item></channel></rss>`;
    expect(rss.normalize(empty, rssConfig(), now)[0]!.summary).toBeNull();
  });

  it('non-http(s) item link → url null (still usable as id)', () => {
    const body = `<rss><channel><item><title>T</title><link>javascript:alert(1)</link></item>
      <item><title>U</title><link>file:///etc/passwd</link></item></channel></rss>`;
    const events = rss.normalize(body, rssConfig(), now);
    expect(events.map((e) => e.url)).toEqual([null, null]);
    expect(events.map((e) => e.externalId)).toEqual(['javascript:alert(1)', 'file:///etc/passwd']);
  });

  it('item with no guid, link or title is skipped; title is the last-resort id', () => {
    const body = `<rss><channel><item><description>no id</description></item>
      <item><guid> </guid><link></link><title>  </title></item>
      <item><title>Only a title</title></item></channel></rss>`;
    const events = rss.normalize(body, rssConfig(), now);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ externalId: 'Only a title', url: null });
  });

  it('config: unknown country and non-http(s) feed url rejected', () => {
    expect(() => rssConfig({ country: 'XX' })).toThrow();
    expect(() => rssConfig({ url: 'file:///etc/passwd' })).toThrow();
    expect(() => rssConfig({ url: 'javascript:alert(1)' })).toThrow();
    expect(rssConfig({ url: 'http://example.com/rss' }).url).toBe('http://example.com/rss');
    expect(rss.url(rssConfig())).toBe('https://telex.hu/rss');
  });
});

describe('coingecko', () => {
  const cfg = coingecko.configSchema.parse({});

  it('defaults', () => expect(cfg).toEqual({ coins: ['bitcoin', 'ethereum'], minChangePct: 3 }));

  it('url lists coins with 24h change', () => {
    expect(coingecko.url(cfg)).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
    );
  });

  it('fixture (+1.04%, +1.26%) → 0 events', () => {
    expect(coingecko.normalize(fixture('coingecko.json'), cfg, now)).toHaveLength(0);
  });

  it('BTC -6 → severity 1, ETH +4 → 4/6', () => {
    const body = JSON.stringify({
      bitcoin: { usd: 81941, usd_24h_change: -6 },
      ethereum: { usd: 2400.65, usd_24h_change: 4 },
    });
    const events = coingecko.normalize(body, cfg, now);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      source: 'coingecko', category: 'market', severity: 1.0, scope: 'global', country: null, externalId: 'bitcoin:2026-10-19:6',
    });
    expect(events[0]!.title).toContain('-6.0%');
    expect(events[1]!.severity).toBeCloseTo(4 / 6, 9);
    expect(events[1]!.title).toContain('+4.0%');
    expect(events[1]!.externalId).toBe('ethereum:2026-10-19:4');
  });
});

describe('coingecko escalation bands', () => {
  const cfg = coingecko.configSchema.parse({ coins: ['bitcoin'] });
  const at = (change: number) => coingecko.normalize(JSON.stringify({ bitcoin: { usd: 1, usd_24h_change: change } }), cfg, now);

  it.each([
    [3, ':3'], [-3.1, ':3'], [3.99, ':3'], [4, ':4'], [-5.9, ':4'], [6, ':6'], [-8, ':6'],
  ])('change %s → band %s', (change, band) => {
    const [e] = at(change);
    expect(e!.externalId).toBe(`bitcoin:2026-10-19${band}`);
    expect(e!.severity).toBeCloseTo(Math.min(1, Math.abs(change) / 6), 9);
  });

  it('2.99% → no event', () => expect(at(2.99)).toHaveLength(0));

  it('-3.1% then -8% the same UTC day → two events; the second alerts a HU user at the default threshold', () => {
    const db = makeDb();
    const user = addUser(db, { homeCountry: 'HU' });
    addRule(db, user, { channelIds: [addChannel(db, user)] });
    const first = ingest(db, at(-3.1), now);
    expect(first.inserted).toHaveLength(1);
    expect(first.deliveriesCreated).toBe(0);
    const second = ingest(db, at(-8), now);
    expect(second.inserted).toHaveLength(1);
    expect(second.inserted[0]!.externalId).toBe('bitcoin:2026-10-19:6');
    expect(second.deliveriesCreated).toBe(1);
    // a re-poll in the same band is deduped
    expect(ingest(db, at(-7), now).inserted).toHaveLength(0);
  });
});

describe('garbage body', () => {
  it.each([
    ['gdacs', () => gdacs.normalize('<html>oops', {}, now)],
    ['rss', () => rss.normalize('<html>oops', rssConfig(), now)],
    ['coingecko', () => coingecko.normalize('<html>oops', coingecko.configSchema.parse({}), now)],
  ])('%s throws', (_name, fn) => expect(fn).toThrow());
});

describe('manualEvent', () => {
  it('country event', () => {
    const e = manualEvent(ManualEventInput.parse({ category: 'disaster', title: 'Flood', country: 'HU', severity: 0.95 }), now);
    expect(e).toMatchObject({
      source: 'manual', category: 'disaster', title: 'Flood', summary: null, url: null,
      scope: 'country', country: 'HU', severity: 0.95, occurredAt: now.toISOString(),
    });
    expect(e.externalId).toMatch(/^manual:[0-9a-f-]{36}$/);
  });

  it('accepts http(s) url', () => {
    expect(ManualEventInput.parse({ category: 'news', title: 'X', severity: 0.5, url: 'https://a.test/x' }).url).toBe('https://a.test/x');
    expect(ManualEventInput.parse({ category: 'news', title: 'X', severity: 0.5, url: 'http://a.test/x' }).url).toBe('http://a.test/x');
  });

  it('no country → global', () => {
    const e = manualEvent(ManualEventInput.parse({ category: 'news', title: 'X', severity: 0.5 }), now);
    expect(e).toMatchObject({ scope: 'global', country: null });
  });

  it.each([
    [{ category: 'sports', title: 'X', severity: 0.5 }],
    [{ category: 'news', title: 'X', severity: 1.5 }],
    [{ category: 'news', title: 'X', severity: 0.5, country: 'XX' }],
    [{ category: 'news', title: '', severity: 0.5 }],
    [{ category: 'news', title: 'X', severity: 0.5, url: 'javascript:alert(1)' }],
    [{ category: 'news', title: 'X', severity: 0.5, url: 'file:///etc/passwd' }],
  ])('rejects %j', (input) => expect(ManualEventInput.safeParse(input).success).toBe(false));
});
