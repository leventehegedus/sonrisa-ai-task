import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { pollSource } from '../src/pipeline/poll';
import { runTick, startScheduler } from '../src/pipeline/scheduler';
import { ingest } from '../src/pipeline/ingest';
import type { ChannelAdapter } from '../src/channels';
import { addChannel, addRule, addUser, makeDb } from './helpers';

const gdacsXml = readFileSync(new URL('./fixtures/gdacs.xml', import.meta.url), 'utf8');
const telexXml = readFileSync(new URL('./fixtures/telex.xml', import.meta.url), 'utf8');
const t0 = new Date('2026-10-19T12:00:00Z');
const now = () => t0;
type Db = ReturnType<typeof makeDb>;

function addSource(db: Db, o: { type?: string; name?: string; config?: unknown; enabled?: boolean; interval?: number; lastPolledAt?: string | null; baselineAt?: string | null } = {}): number {
  return Number(db.prepare(`INSERT INTO sources (type, name, config, enabled, poll_interval_s, last_polled_at, baseline_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(o.type ?? 'gdacs', o.name ?? 'GDACS', JSON.stringify(o.config ?? {}), o.enabled === false ? 0 : 1, o.interval ?? 300, o.lastPolledAt ?? null, o.baselineAt ?? null).lastInsertRowid);
}
const source = (db: Db, id: number) => db.prepare(`SELECT * FROM sources WHERE id = ?`).get(id) as any;
const eventCount = (db: Db) => (db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as any).n as number;

/** Stub fetch: answers per URL (default: every URL gets the same reply). */
function stubFetch(reply: (url: string) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: any, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply(String(url)); }) as typeof fetch;
  return { fetchImpl, calls };
}
const RSS_URL = 'https://example.com/feed.xml';
const rssConfig = { feedId: 'ex', url: RSS_URL, country: 'HU', breakingKeywords: [] };

describe('pollSource', () => {
  it('polls GDACS: inserts 225 events, clears last_error, sets last_polled_at, sends UA + timeout signal', async () => {
    const db = makeDb();
    const id = addSource(db);
    db.prepare(`UPDATE sources SET last_error = 'old' WHERE id = ?`).run(id);
    const f = stubFetch(() => new Response(gdacsXml, { status: 200 }));
    expect(await pollSource(db, id, { fetchImpl: f.fetchImpl, now })).toEqual({ ok: true, inserted: 225 });
    expect(eventCount(db)).toBe(225);
    expect(source(db, id)).toMatchObject({ last_error: null, last_polled_at: t0.toISOString() });
    expect(f.calls[0].url).toBe('https://www.gdacs.org/xml/rss.xml');
    expect((f.calls[0].init?.headers as Record<string, string>)['User-Agent']).toBe('world-alerts/0.1');
    expect(f.calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    // second poll of the same body: deduped, still ok
    expect(await pollSource(db, id, { fetchImpl: f.fetchImpl, now })).toEqual({ ok: true, inserted: 0 });
  });

  it('HTTP 500 → ok:false, last_error mentions 500 (not the body), 0 events', async () => {
    const db = makeDb();
    const id = addSource(db);
    const f = stubFetch(() => new Response('<html>SECRET BODY</html>', { status: 500 }));
    const r = await pollSource(db, id, { fetchImpl: f.fetchImpl, now });
    expect(r).toMatchObject({ ok: false, inserted: 0 });
    expect(r.error).toContain('500');
    const row = source(db, id);
    expect(row.last_error).toContain('500');
    expect(row.last_error).not.toContain('SECRET BODY');
    expect(row.last_polled_at).toBe(t0.toISOString());
    expect(eventCount(db)).toBe(0);
  });

  it("'<html>oops' with 200 → ok:false, last_error set, 0 events", async () => {
    const db = makeDb();
    const id = addSource(db);
    const r = await pollSource(db, id, { fetchImpl: stubFetch(() => new Response('<html>oops', { status: 200 })).fetchImpl, now });
    expect(r).toMatchObject({ ok: false, inserted: 0 });
    expect(source(db, id).last_error).toBeTruthy();
    expect(eventCount(db)).toBe(0);
  });

  it('truncated GDACS XML → ok:false, no partial events', async () => {
    const db = makeDb();
    const id = addSource(db);
    const body = gdacsXml.slice(0, Math.floor(gdacsXml.length / 2));
    const r = await pollSource(db, id, { fetchImpl: stubFetch(() => new Response(body)).fetchImpl, now });
    expect(r).toMatchObject({ ok: false, inserted: 0 });
    expect(source(db, id).last_error).toBeTruthy();
    expect(eventCount(db)).toBe(0);
  });

  it('fetch throws (network error) → ok:false with the message; long messages capped at 500 chars', async () => {
    const db = makeDb();
    const id = addSource(db);
    const r = await pollSource(db, id, { fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch, now });
    expect(r).toEqual({ ok: false, inserted: 0, error: 'fetch failed' });
    expect(source(db, id).last_error).toBe('fetch failed');

    await pollSource(db, id, { fetchImpl: (async () => { throw new Error('x'.repeat(2000)); }) as typeof fetch, now });
    expect(source(db, id).last_error).toHaveLength(500);
  });

  it('unknown source id → source not found, no DB write', async () => {
    const db = makeDb();
    const f = stubFetch(() => new Response(gdacsXml));
    expect(await pollSource(db, 999, { fetchImpl: f.fetchImpl, now })).toEqual({ ok: false, inserted: 0, error: 'source not found' });
    expect(f.calls).toHaveLength(0);
  });

  it('unknown adapter type / invalid config → ok:false, last_error written, no fetch', async () => {
    const db = makeDb();
    const f = stubFetch(() => new Response(gdacsXml));
    const bad = addSource(db, { type: 'twitter' });
    expect(await pollSource(db, bad, { fetchImpl: f.fetchImpl, now })).toMatchObject({ ok: false, inserted: 0 });
    expect(source(db, bad)).toMatchObject({ last_polled_at: t0.toISOString() });
    expect(source(db, bad).last_error).toContain('twitter');

    const badCfg = addSource(db, { type: 'rss', config: { feedId: '', url: 'ftp://x' } });
    expect(await pollSource(db, badCfg, { fetchImpl: f.fetchImpl, now })).toMatchObject({ ok: false, inserted: 0 });
    expect(source(db, badCfg).last_error).toMatch(/invalid config/);

    const badJson = addSource(db);
    db.prepare(`UPDATE sources SET config = '{not json' WHERE id = ?`).run(badJson);
    expect(await pollSource(db, badJson, { fetchImpl: f.fetchImpl, now })).toMatchObject({ ok: false, inserted: 0 });
    expect(source(db, badJson).last_error).toMatch(/invalid config/);
    expect(f.calls).toHaveLength(0);
  });
});

function fakeRegistry() {
  const sent: string[] = [];
  const adapter: ChannelAdapter<any> = {
    type: 'email', configSchema: z.object({ to: z.string() }).loose(), maskConfig: (c) => c,
    send: async (_c, m) => { sent.push(m.title); },
  };
  return { sent, registry: { email: adapter } as Record<string, ChannelAdapter<any>> };
}

describe('pollSource backfill baseline', () => {
  const hu = (db: Db) => { const u = addUser(db); addRule(db, u, { channelIds: [addChannel(db, u)] }); };
  const deliveryCount = (db: Db) => (db.prepare(`SELECT COUNT(*) AS n FROM deliveries`).get() as any).n as number;

  it('first poll (baseline_at NULL) stores events but creates no deliveries', async () => {
    const db = makeDb();
    hu(db);
    const id = addSource(db, { type: 'rss', config: rssConfig });
    const f = stubFetch(() => new Response(telexXml));
    expect(await pollSource(db, id, { fetchImpl: f.fetchImpl, now })).toEqual({ ok: true, inserted: 50 });
    expect(deliveryCount(db)).toBe(0);
  });

  it('a later poll (baseline_at set) creates deliveries for new events', async () => {
    const db = makeDb();
    hu(db);
    const id = addSource(db, { type: 'rss', config: rssConfig, lastPolledAt: new Date(t0.getTime() - 300_000).toISOString(), baselineAt: new Date(t0.getTime() - 300_000).toISOString() });
    const f = stubFetch(() => new Response(telexXml));
    expect(await pollSource(db, id, { fetchImpl: f.fetchImpl, now })).toEqual({ ok: true, inserted: 50 });
    expect(deliveryCount(db)).toBe(50); // HU news, base severity 0.5 × home 1.0 = threshold
  });

  it('a failed first poll keeps the baseline: the next successful poll creates no deliveries, then new items do', async () => {
    const db = makeDb();
    hu(db);
    const id = addSource(db, { type: 'rss', config: rssConfig });
    expect(await pollSource(db, id, { fetchImpl: stubFetch(() => new Response('down', { status: 500 })).fetchImpl, now })).toMatchObject({ ok: false });
    expect(source(db, id)).toMatchObject({ last_polled_at: t0.toISOString(), baseline_at: null });

    expect(await pollSource(db, id, { fetchImpl: stubFetch(() => new Response(telexXml)).fetchImpl, now })).toEqual({ ok: true, inserted: 50 });
    expect(deliveryCount(db)).toBe(0);
    expect(source(db, id).baseline_at).toBe(t0.toISOString());

    const extra = telexXml.replace('<item>', '<item><title>Brand new</title><link>https://example.com/new</link><guid>brand-new</guid><pubDate>Mon, 19 Oct 2026 11:59:00 GMT</pubDate></item><item>');
    expect(await pollSource(db, id, { fetchImpl: stubFetch(() => new Response(extra)).fetchImpl, now })).toEqual({ ok: true, inserted: 1 });
    expect(deliveryCount(db)).toBe(1);
  });
});

describe('runTick', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('a failing source does not stop the next one; failure is logged', async () => {
    const db = makeDb();
    const broken = addSource(db, { type: 'rss', name: 'Broken', config: rssConfig });
    const good = addSource(db);
    const f = stubFetch((url) => (url === RSS_URL ? new Response('down', { status: 500 }) : new Response(gdacsXml)));
    const log = vi.fn();
    const r = await runTick(db, { fetchImpl: f.fetchImpl, registry: fakeRegistry().registry, now, log });
    expect(r.polled).toBe(2);
    expect(source(db, broken).last_error).toContain('500');
    expect(source(db, good).last_error).toBeNull();
    expect(eventCount(db)).toBe(225);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('Broken');
  });

  it('polls only enabled sources that are due', async () => {
    const db = makeDb();
    const disabled = addSource(db, { enabled: false });
    const fresh = addSource(db, { interval: 300, lastPolledAt: new Date(t0.getTime() - 299_000).toISOString() });
    const due = addSource(db, { interval: 300, lastPolledAt: new Date(t0.getTime() - 300_000).toISOString() });
    const f = stubFetch(() => new Response(gdacsXml));
    const r = await runTick(db, { fetchImpl: f.fetchImpl, registry: fakeRegistry().registry, now, log: () => {} });
    expect(r.polled).toBe(1);
    expect(f.calls).toHaveLength(1);
    expect(source(db, disabled).last_polled_at).toBeNull();
    expect(source(db, fresh).last_polled_at).not.toBe(t0.toISOString());
    expect(source(db, due).last_polled_at).toBe(t0.toISOString());
  });

  it('dispatches pending deliveries after polling', async () => {
    const db = makeDb();
    const user = addUser(db);
    addRule(db, user, { channelIds: [addChannel(db, user)], threshold: 0 });
    ingest(db, [{ source: 's', externalId: 'e1', category: 'news', title: 'Hello', summary: null, url: null, scope: 'country', country: 'HU', severity: 0.5, occurredAt: t0.toISOString(), raw: {} }], t0);
    const reg = fakeRegistry();
    const r = await runTick(db, { fetchImpl: stubFetch(() => new Response(gdacsXml)).fetchImpl, registry: reg.registry, now, log: () => {} });
    expect(r.dispatch).toEqual({ sent: 1, failed: 0, retried: 0 });
    expect(reg.sent).toEqual(['Hello']);
  });

  it('a dispatch fault is logged and runTick still resolves', async () => {
    const db = makeDb();
    db.exec(`DROP TABLE deliveries`);
    const log = vi.fn();
    const r = await runTick(db, { fetchImpl: stubFetch(() => new Response(gdacsXml)).fetchImpl, registry: fakeRegistry().registry, now, log });
    expect(r.dispatch).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^dispatch error: /));
  });
});

describe('startScheduler', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('ticks immediately and every 10s, skipping a tick while the previous one still runs; stop() clears it', async () => {
    vi.useFakeTimers();
    const db = makeDb();
    addSource(db);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const f = stubFetch(async () => { await gate; return new Response(gdacsXml); });
    // a clock that moves with the fake timers, so the source becomes due again after its interval
    const clock = () => new Date(t0.getTime() + Date.now());
    vi.setSystemTime(0);
    const s = startScheduler(db, { fetchImpl: f.fetchImpl, registry: fakeRegistry().registry, now: clock, log: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(1); // immediate tick, stuck in fetch
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.calls).toHaveLength(1); // second tick skipped by the guard (source is still due: last_polled_at not yet written)
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(eventCount(db)).toBe(225);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(f.calls).toHaveLength(2); // due again after poll_interval_s, guard released
    s.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(f.calls).toHaveLength(2);
  });

  it('a throwing log never becomes an unhandled rejection', async () => {
    const db = makeDb();
    addSource(db, { type: 'twitter' }); // fails every poll → log is called
    const rejections: unknown[] = [];
    const onRejection = (r: unknown) => { rejections.push(r); };
    process.on('unhandledRejection', onRejection);
    try {
      const s = startScheduler(db, { fetchImpl: stubFetch(() => new Response('')).fetchImpl, registry: fakeRegistry().registry, now, log: () => { throw new Error('log down'); } });
      await new Promise((r) => setTimeout(r, 20));
      s.stop();
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(rejections).toEqual([]);
  });
});
