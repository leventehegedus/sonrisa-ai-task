import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceAdapters } from '../src/sources';
import { manualEvent, ManualEventInput } from '../src/sources/manual';

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

  it('config: unknown country rejected', () => {
    expect(() => rssConfig({ country: 'XX' })).toThrow();
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
      source: 'coingecko', category: 'market', severity: 1.0, scope: 'global', country: null, externalId: 'bitcoin:2026-10-19',
    });
    expect(events[0]!.title).toContain('-6.0%');
    expect(events[1]!.severity).toBeCloseTo(4 / 6, 9);
    expect(events[1]!.title).toContain('+4.0%');
    expect(events[1]!.externalId).toBe('ethereum:2026-10-19');
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

  it('no country → global', () => {
    const e = manualEvent(ManualEventInput.parse({ category: 'news', title: 'X', severity: 0.5 }), now);
    expect(e).toMatchObject({ scope: 'global', country: null });
  });

  it.each([
    [{ category: 'sports', title: 'X', severity: 0.5 }],
    [{ category: 'news', title: 'X', severity: 1.5 }],
    [{ category: 'news', title: 'X', severity: 0.5, country: 'XX' }],
    [{ category: 'news', title: '', severity: 0.5 }],
  ])('rejects %j', (input) => expect(ManualEventInput.safeParse(input).success).toBe(false));
});
