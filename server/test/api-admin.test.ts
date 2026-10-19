import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { createChannelRegistry } from '../src/channels';
import { seed } from '../src/db/seed';
import { makeDb } from './helpers';

const SECRET_HOOK = 'https://hooks.slack.com/services/T000/B000/abcdSECRET1234';
const telexXml = fs.readFileSync(new URL('./fixtures/telex.xml', import.meta.url), 'utf8');
const t0 = new Date('2026-10-19T12:00:00Z');
// Seeded ids: users Anna 1 (admin), Bence 2, Priya 3 (NP); sources 1 GDACS, 2 CoinGecko, 3 Telex, 4 HVG, 5 BBC.
const ANNA = 1, BENCE = 2, PRIYA = 3, TELEX = 3;

let db: ReturnType<typeof makeDb>;
let app: FastifyInstance;
let fetched: string[];

beforeEach(() => {
  db = makeDb();
  seed(db);
  fetched = [];
  const fetchImpl = (async (url: any) => { fetched.push(String(url)); return new Response(telexXml, { status: 200 }); }) as unknown as typeof fetch;
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-outbox-'));
  const registry = createChannelRegistry({ outboxDir, slackDryRun: true, log: () => {} });
  app = buildApp(db, { registry, fetchImpl, now: () => t0, log: () => {} });
});

type Method = 'GET' | 'POST' | 'PATCH';
const req = (method: Method, url: string, user: number, payload?: unknown) =>
  app.inject({ method, url, headers: { 'x-user-id': String(user) }, ...(payload === undefined ? {} : { payload: payload as any }) });
const inject = (body: unknown) => req('POST', '/api/admin/events', ANNA, body);
const userOfDelivery = (d: { userId: number }) => d.userId;
const setStatus = (id: number, status: string) =>
  db.prepare(`UPDATE deliveries SET status = ?, attempts = 3, last_error = 'boom', next_attempt_at = NULL WHERE id = ?`).run(status, id);

describe('admin access', () => {
  const routes: [Method, string, unknown?][] = [
    ['GET', '/api/admin/users'], ['GET', '/api/admin/rules'], ['GET', '/api/admin/events'], ['GET', '/api/admin/deliveries'],
    ['POST', '/api/admin/deliveries/1/retry'], ['GET', '/api/admin/sources'], ['PATCH', '/api/admin/sources/1', { enabled: false }],
    ['POST', '/api/admin/sources/1/poll'], ['POST', '/api/admin/events', { category: 'news', title: 'x', severity: 1 }],
  ];
  it.each(routes)('%s %s → 403 for a non-admin, writes nothing', async (method, url, body) => {
    const res = await req(method, url, BENCE, body);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'admin only' });
    expect(fetched).toEqual([]);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as any).n).toBe(0);
    expect((db.prepare(`SELECT enabled FROM sources WHERE id = 1`).get() as any).enabled).toBe(1);
  });
  it('no X-User-Id with a malformed JSON body → 401, not 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/events', headers: { 'content-type': 'application/json' }, payload: '{bad' });
    expect(res.statusCode).toBe(401);
  });
  it('a known user with a malformed JSON body → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/events', headers: { 'content-type': 'application/json', 'x-user-id': '1' }, payload: '{bad' });
    expect(res.statusCode).toBe(400);
  });
});

describe('users, rules, events', () => {
  it('GET /users lists users without channel configs', async () => {
    const res = await req('GET', '/api/admin/users', ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { id: ANNA, name: 'Anna', email: 'anna@example.com', homeCountry: 'HU', isAdmin: true },
      { id: BENCE, name: 'Bence', email: 'bence@example.com', homeCountry: 'HU', isAdmin: false },
      { id: PRIYA, name: 'Priya', email: 'priya@example.com', homeCountry: 'NP', isAdmin: false },
    ]);
  });
  it('GET /rules lists every user\'s rules with userId', async () => {
    const res = await req('GET', '/api/admin/rules', ANNA);
    expect(res.json().map((r: any) => r.userId)).toEqual([ANNA, BENCE, PRIYA]);
    expect(res.json()[0]).toMatchObject({ name: 'Default', threshold: 0.5, channelIds: [1], enabled: true });
  });
  it('GET /events: newest first, default limit 100, ?limit validated (1..500)', async () => {
    for (const title of ['first', 'second']) await inject({ category: 'news', title, severity: 0.1 });
    const all = await req('GET', '/api/admin/events', ANNA);
    expect(all.json().map((e: any) => e.title)).toEqual(['second', 'first']);
    expect(all.json()[0]).toMatchObject({ source: 'manual', scope: 'global', severity: 0.1 });
    expect((await req('GET', '/api/admin/events?limit=1', ANNA)).json().map((e: any) => e.title)).toEqual(['second']);
    for (const bad of ['0', '501', 'x', '1.5']) expect((await req('GET', `/api/admin/events?limit=${bad}`, ANNA)).statusCode).toBe(400);
  });
});

describe('POST /events (inject)', () => {
  it('HU severity 0.6 → Anna and Bence get one each, Priya none', async () => {
    const res = await inject({ category: 'disaster', title: 'Árvíz a Dunán', country: 'HU', severity: 0.6 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ deliveriesCreated: 2, event: { id: expect.any(Number), source: 'manual', title: 'Árvíz a Dunán', country: 'HU', scope: 'country', occurredAt: t0.toISOString() } });
    const ds = (await req('GET', '/api/admin/deliveries', ANNA)).json();
    expect(ds.map(userOfDelivery).sort()).toEqual([ANNA, BENCE]);
  });
  it('Red severity 1.0 in NP → all three users get one (critical override)', async () => {
    const res = await inject({ category: 'disaster', title: 'Earthquake', country: 'NP', severity: 1 });
    expect(res.json().deliveriesCreated).toBe(3);
    const ds = (await req('GET', '/api/admin/deliveries', ANNA)).json();
    expect(ds.map(userOfDelivery).sort()).toEqual([ANNA, BENCE, PRIYA]);
    expect(ds[0].breakdown.override).toBe(true);
  });
  it.each([
    ['unknown key', { category: 'news', title: 'x', severity: 0.5, extra: 1 }],
    ['unknown country', { category: 'news', title: 'x', severity: 0.5, country: 'XX' }],
    ['severity out of range', { category: 'news', title: 'x', severity: 1.5 }],
    ['blank title', { category: 'news', title: '  ', severity: 0.5 }],
    ['unknown category', { category: 'sports', title: 'x', severity: 0.5 }],
  ])('%s → 400, nothing written', async (_name, body) => {
    const res = await inject(body);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid request', issues: expect.any(Array) });
    expect((db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as any).n).toBe(0);
  });
});

describe('deliveries', () => {
  it('lists the /my/deliveries shape plus userId; never leaks a Slack webhook', async () => {
    db = makeDb();
    seed(db, { slackWebhook: SECRET_HOOK });
    app = buildApp(db, { registry: createChannelRegistry({ outboxDir: os.tmpdir(), slackDryRun: true, log: () => {} }), fetchImpl: fetch, now: () => t0, log: () => {} });
    await inject({ category: 'news', title: 'HU news', country: 'HU', severity: 0.6 });
    const res = await req('GET', '/api/admin/deliveries', ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(3); // Anna email, Bence email + slack
    expect(res.json()[0]).toEqual({
      id: expect.any(Number), userId: expect.any(Number), status: 'pending', attempts: 0, lastError: null, createdAt: t0.toISOString(), sentAt: null,
      channelId: expect.any(Number), ruleId: expect.any(Number), breakdown: expect.objectContaining({ fires: true }),
      event: { id: 1, title: 'HU news', category: 'news', country: 'HU', scope: 'country', url: null, occurredAt: t0.toISOString() },
    });
    expect(res.body).not.toContain('abcdSECRET1234');
    expect(res.body).not.toContain('hooks.slack.com');
  });
  it('?status= filters, an unknown status → 400', async () => {
    await inject({ category: 'news', title: 'HU news', country: 'HU', severity: 0.6 });
    setStatus(1, 'failed');
    expect((await req('GET', '/api/admin/deliveries?status=failed', ANNA)).json().map((d: any) => d.id)).toEqual([1]);
    expect((await req('GET', '/api/admin/deliveries?status=pending', ANNA)).json().map((d: any) => d.id)).toEqual([2]);
    expect((await req('GET', '/api/admin/deliveries?status=bogus', ANNA)).statusCode).toBe(400);
  });
  it('retry: failed → pending, attempts 0, next_attempt_at now, last_error cleared', async () => {
    await inject({ category: 'news', title: 'HU news', country: 'HU', severity: 0.6 });
    setStatus(1, 'failed');
    const res = await req('POST', '/api/admin/deliveries/1/retry', ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 1, status: 'pending', attempts: 0, lastError: null, userId: expect.any(Number) });
    expect(db.prepare(`SELECT status, attempts, last_error, next_attempt_at FROM deliveries WHERE id = 1`).get())
      .toEqual({ status: 'pending', attempts: 0, last_error: null, next_attempt_at: t0.toISOString() });
  });
  it.each(['sent', 'pending'])('retry on a %s delivery → 409, unchanged', async (status) => {
    await inject({ category: 'news', title: 'HU news', country: 'HU', severity: 0.6 });
    setStatus(1, status);
    const res = await req('POST', '/api/admin/deliveries/1/retry', ANNA);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'only failed deliveries can be retried' });
    expect(db.prepare(`SELECT status, attempts FROM deliveries WHERE id = 1`).get()).toEqual({ status, attempts: 3 });
  });
  it('retry: unknown id → 404, bad id → 400', async () => {
    expect((await req('POST', '/api/admin/deliveries/99/retry', ANNA)).statusCode).toBe(404);
    expect((await req('POST', '/api/admin/deliveries/abc/retry', ANNA)).statusCode).toBe(400);
  });
});

describe('sources', () => {
  it('GET /sources lists sources with camelCase fields', async () => {
    const res = await req('GET', '/api/admin/sources', ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(5);
    expect(res.json()[TELEX - 1]).toEqual({
      id: TELEX, type: 'rss', name: 'Telex', config: { feedId: 'telex', url: 'https://telex.hu/rss', country: 'HU', breakingKeywords: ['rendkívüli', 'breaking'] },
      enabled: true, pollIntervalS: 300, lastPolledAt: null, lastError: null, baselineAt: null,
    });
  });
  it('PATCH updates enabled and poll_interval_s', async () => {
    const res = await req('PATCH', `/api/admin/sources/${TELEX}`, ANNA, { enabled: false, poll_interval_s: 600 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: TELEX, enabled: false, pollIntervalS: 600 });
    expect((await req('PATCH', `/api/admin/sources/${TELEX}`, ANNA, { enabled: true })).json()).toMatchObject({ enabled: true, pollIntervalS: 600 });
  });
  it.each([
    ['interval below 60', { poll_interval_s: 5 }], ['interval above 86400', { poll_interval_s: 86401 }],
    ['non-integer interval', { poll_interval_s: 60.5 }], ['empty body', {}], ['unknown key', { enabled: true, name: 'x' }],
  ])('PATCH %s → 400, unchanged', async (_name, body) => {
    expect((await req('PATCH', `/api/admin/sources/${TELEX}`, ANNA, body)).statusCode).toBe(400);
    expect(db.prepare(`SELECT enabled, poll_interval_s FROM sources WHERE id = ?`).get(TELEX)).toEqual({ enabled: 1, poll_interval_s: 300 });
  });
  it('PATCH unknown id → 404', async () => {
    expect((await req('PATCH', '/api/admin/sources/99', ANNA, { enabled: false })).statusCode).toBe(404);
  });
  it('POST /poll runs pollSource (even when disabled) and returns its result', async () => {
    db.prepare(`UPDATE sources SET enabled = 0 WHERE id = ?`).run(TELEX);
    const res = await req('POST', `/api/admin/sources/${TELEX}/poll`, ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, inserted: expect.any(Number) });
    expect(res.json().inserted).toBeGreaterThan(0);
    expect(fetched).toEqual(['https://telex.hu/rss']);
    expect((await req('GET', '/api/admin/sources', ANNA)).json()[TELEX - 1]).toMatchObject({ lastPolledAt: t0.toISOString(), lastError: null, baselineAt: t0.toISOString() });
  });
  it('POST /poll with a failing feed → 200 ok:false; unknown id → 404', async () => {
    db.prepare(`UPDATE sources SET config = '{"bad":1}' WHERE id = ?`).run(TELEX);
    const res = await req('POST', `/api/admin/sources/${TELEX}/poll`, ANNA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: false, inserted: 0, error: 'invalid config' });
    expect((await req('POST', '/api/admin/sources/99/poll', ANNA)).statusCode).toBe(404);
  });
});
