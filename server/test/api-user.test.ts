import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { requireAdmin } from '../src/http/auth';
import { createChannelRegistry } from '../src/channels';
import { ingest } from '../src/pipeline/ingest';
import { addChannel, addRule, addUser, makeDb } from './helpers';

const SECRET_HOOK = 'https://hooks.slack.com/services/T000/B000/abcdSECRET1234';
const t0 = new Date('2026-10-19T12:00:00Z');

let db: ReturnType<typeof makeDb>;
let app: FastifyInstance;
let anna: number, bence: number;
let logs: string[];
let slackStatus: number;

beforeEach(() => {
  db = makeDb();
  anna = addUser(db, { name: 'Anna', email: 'anna@example.com', isAdmin: true });
  bence = addUser(db, { name: 'Bence', email: 'bence@example.com' });
  logs = [];
  slackStatus = 200;
  const fetchImpl = (async () => new Response('', { status: slackStatus })) as unknown as typeof fetch;
  const outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-outbox-'));
  const registry = createChannelRegistry({ outboxDir, slackDryRun: false, fetchImpl, log: () => {} });
  app = buildApp(db, { registry, fetchImpl, now: () => t0, log: (m) => logs.push(m) });
});

const as = (userId: number | string) => ({ 'x-user-id': String(userId) });
const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, user: number | string, payload?: unknown) =>
  app.inject({ method, url, headers: as(user), ...(payload === undefined ? {} : { payload: payload as any }) });
const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const channelIdsOf = (ruleId: number) => JSON.parse((db.prepare(`SELECT channel_ids FROM rules WHERE id = ?`).get(ruleId) as any).channel_ids);

describe('identity', () => {
  it('no X-User-Id → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
  });
  it.each(['1abc', '0', '-1', '1.5', '999'])('X-User-Id %s → 401', async (id) => {
    expect((await req('GET', '/api/me', id)).statusCode).toBe(401);
  });
  it('GET /api/me returns the user', async () => {
    const res = await req('GET', '/api/me', bence);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: bence, name: 'Bence', email: 'bence@example.com', homeCountry: 'HU', isAdmin: false });
  });
  it('requireAdmin → 403 for non-admins, passes admins', async () => {
    const reply = { code: (c: number) => ({ send: (b: unknown) => ({ c, b }) }) } as any;
    expect(await requireAdmin({ user: { isAdmin: false } } as any, reply)).toEqual({ c: 403, b: { error: 'admin only' } });
    expect(await requireAdmin({ user: { isAdmin: true } } as any, reply)).toBeUndefined();
  });
});

describe('rules', () => {
  it('CRUD round-trip', async () => {
    const ch = addChannel(db, bence);
    const created = await req('POST', '/api/rules', bence, { name: 'Floods', categories: ['disaster'], keywords: ['árvíz'], threshold: 0.4, channelIds: [ch, ch] });
    expect(created.statusCode).toBe(201);
    const rule = created.json();
    expect(rule).toEqual({ id: expect.any(Number), userId: bence, name: 'Floods', categories: ['disaster'], keywords: ['árvíz'], threshold: 0.4, channelIds: [ch], enabled: true });

    expect((await req('GET', '/api/rules', bence)).json()).toEqual([rule]);
    expect((await req('GET', `/api/rules/${rule.id}`, bence)).json()).toEqual(rule);

    const patched = await req('PATCH', `/api/rules/${rule.id}`, bence, { threshold: 0.7, enabled: false });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({ ...rule, threshold: 0.7, enabled: false });

    expect((await req('DELETE', `/api/rules/${rule.id}`, bence)).statusCode).toBe(204);
    expect((await req('GET', '/api/rules', bence)).json()).toEqual([]);
  });

  it('create applies defaults', async () => {
    const res = await req('POST', '/api/rules', bence, { name: 'All' });
    expect(res.json()).toMatchObject({ categories: [], keywords: [], threshold: 0.5, channelIds: [], enabled: true });
  });

  it("another user's rule → 404 on GET/PATCH/DELETE, and is untouched", async () => {
    const r = addRule(db, anna, { name: 'mine' });
    expect((await req('GET', `/api/rules/${r}`, bence)).statusCode).toBe(404);
    expect((await req('PATCH', `/api/rules/${r}`, bence, { name: 'x' })).statusCode).toBe(404);
    expect((await req('DELETE', `/api/rules/${r}`, bence)).statusCode).toBe(404);
    expect((db.prepare(`SELECT name FROM rules WHERE id = ?`).get(r) as any).name).toBe('mine');
    expect((await req('GET', '/api/rules', bence)).json()).toEqual([]);
  });

  it('bad path id → 400', async () => {
    expect((await req('GET', '/api/rules/abc', bence)).statusCode).toBe(400);
  });

  // Review Focus 5: out-of-range or unknown input → 400 and nothing written.
  it.each([
    ['threshold 1.5', { name: 'r', threshold: 1.5 }],
    ['category sports', { name: 'r', categories: ['sports'] }],
    ['empty name', { name: '' }],
    ['21 keywords', { name: 'r', keywords: Array.from({ length: 21 }, (_, i) => `k${i}`) }],
    ['51-char keyword', { name: 'r', keywords: ['x'.repeat(51)] }],
  ])('POST /api/rules with %s → 400, rules count unchanged', async (_label, body) => {
    const before = count('rules');
    const res = await req('POST', '/api/rules', bence, body);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid request', issues: expect.any(Array) });
    expect(count('rules')).toBe(before);
  });

  it("Review Focus 5: a channelIds entry of another user → 400 on create and update, nothing written", async () => {
    const own = addChannel(db, bence);
    const foreign = addChannel(db, anna);
    const before = count('rules');
    const res = await req('POST', '/api/rules', bence, { name: 'r', channelIds: [own, foreign] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid request');
    expect(count('rules')).toBe(before);

    const r = addRule(db, bence, { channelIds: [own] });
    expect((await req('PATCH', `/api/rules/${r}`, bence, { channelIds: [foreign] })).statusCode).toBe(400);
    expect(channelIdsOf(r)).toEqual([own]);
  });

  it('PATCH threshold 1.5 → 400, rule unchanged', async () => {
    const r = addRule(db, bence, { threshold: 0.5 });
    expect((await req('PATCH', `/api/rules/${r}`, bence, { threshold: 1.5 })).statusCode).toBe(400);
    expect((db.prepare(`SELECT threshold FROM rules WHERE id = ?`).get(r) as any).threshold).toBe(0.5);
  });
});

describe('channels', () => {
  it('email channel: `to` defaults to the user email; round-trip', async () => {
    const res = await req('POST', '/api/channels', bence, { type: 'email' });
    expect(res.statusCode).toBe(201);
    const ch = res.json();
    expect(ch).toEqual({ id: expect.any(Number), type: 'email', config: { to: 'bence@example.com' }, enabled: true });
    const patched = await req('PATCH', `/api/channels/${ch.id}`, bence, { enabled: false, config: { to: 'b2@example.com' } });
    expect(patched.json()).toEqual({ ...ch, enabled: false, config: { to: 'b2@example.com' } });
    expect((await req('GET', `/api/channels/${ch.id}`, bence)).json()).toEqual(patched.json());
  });

  it('Review Focus 2: GET /api/channels never contains the webhook secret', async () => {
    const res = await req('POST', '/api/channels', bence, { type: 'slack', config: { webhookUrl: SECRET_HOOK } });
    expect(res.statusCode).toBe(201);
    expect(res.body).not.toContain('SECRET');
    const list = await req('GET', '/api/channels', bence);
    expect(list.body).not.toContain('SECRET');
    expect(list.json()[0].config.webhookUrl).toBe('https://hooks.slack.com/…/1234');
    const patched = await req('PATCH', `/api/channels/${res.json().id}`, bence, { enabled: false });
    expect(patched.body).not.toContain('SECRET');
  });

  it('PATCH with the masked config echoed from GET → 400, stored secret intact', async () => {
    const created = await req('POST', '/api/channels', bence, { type: 'slack', config: { webhookUrl: SECRET_HOOK } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const got = await req('GET', `/api/channels/${id}`, bence);
    expect(got.statusCode).toBe(200);
    const patched = await req('PATCH', `/api/channels/${id}`, bence, { config: got.json().config });
    expect(patched.statusCode).toBe(400);
    expect(db.prepare(`SELECT config FROM channels WHERE id = ?`).get(id)).toEqual({ config: JSON.stringify({ webhookUrl: SECRET_HOOK }) });
  });

  // Review Focus 5
  it.each([
    ['slack http:// webhook', { type: 'slack', config: { webhookUrl: 'http://hooks.slack.com/services/T0/B0/xxSECRETxx' } }],
    ['slack non-slack host', { type: 'slack', config: { webhookUrl: 'https://evil.example.com/SECRET' } }],
    ['unknown type', { type: 'sms', config: {} }],
    ['bad email', { type: 'email', config: { to: 'not-an-email' } }],
  ])('POST /api/channels with %s → 400, channels count unchanged, no secret echoed', async (_l, body) => {
    const before = count('channels');
    const res = await req('POST', '/api/channels', bence, body);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid request');
    expect(res.body).not.toContain('SECRET');
    expect(count('channels')).toBe(before);
  });

  it('PATCH cannot change type; bad config → 400 and row unchanged', async () => {
    const c = addChannel(db, bence, { type: 'slack', config: { webhookUrl: SECRET_HOOK } });
    expect((await req('PATCH', `/api/channels/${c}`, bence, { type: 'email' })).statusCode).toBe(400);
    expect((await req('PATCH', `/api/channels/${c}`, bence, { config: { webhookUrl: 'http://hooks.slack.com/x' } })).statusCode).toBe(400);
    expect(db.prepare(`SELECT type, config FROM channels WHERE id = ?`).get(c)).toEqual({ type: 'slack', config: JSON.stringify({ webhookUrl: SECRET_HOOK }) });
  });

  it("another user's channel → 404 on GET/PATCH/DELETE/test", async () => {
    const c = addChannel(db, anna);
    for (const [m, u] of [['GET', ''], ['PATCH', ''], ['DELETE', ''], ['POST', '/test']] as const)
      expect((await req(m, `/api/channels/${c}${u}`, bence, m === 'PATCH' ? { enabled: false } : undefined)).statusCode).toBe(404);
    expect(count('channels')).toBe(1);
  });

  it("Review Focus 3: deleting a channel drops it from the user's rules, keeps delivery history", async () => {
    const keep = addChannel(db, bence);
    const gone = addChannel(db, bence);
    const r1 = addRule(db, bence, { channelIds: [keep, gone] });
    const r2 = addRule(db, bence, { channelIds: [gone] });
    ingest(db, [{ source: 's', externalId: 'e', category: 'news', title: 'T', summary: null, url: null, scope: 'country', country: 'HU', severity: 0.9, occurredAt: t0.toISOString(), raw: {} }], t0);
    expect(count('deliveries')).toBe(2); // UNIQUE(event_id, channel_id)

    expect((await req('DELETE', `/api/channels/${gone}`, bence)).statusCode).toBe(204);
    expect(channelIdsOf(r1)).toEqual([keep]);
    expect(channelIdsOf(r2)).toEqual([]);
    expect(count('channels')).toBe(1);
    expect(count('deliveries')).toBe(2);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM deliveries WHERE channel_id IS NULL`).get() as any).n).toBe(1);
  });

  it('POST /:id/test sends through the adapter; errors come back as ok:false (HTTP 200)', async () => {
    const email = addChannel(db, bence, { config: { to: 'bence@example.com' }, enabled: false });
    expect((await req('POST', `/api/channels/${email}/test`, bence)).json()).toEqual({ ok: true });
    const slack = addChannel(db, bence, { type: 'slack', config: { webhookUrl: SECRET_HOOK } });
    slackStatus = 500;
    const res = await req('POST', `/api/channels/${slack}/test`, bence);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: false, error: 'Slack responded 500' });
  });
});

describe('errors', () => {
  it('malformed JSON body → 400 { error }', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/rules', headers: { ...as(bence), 'content-type': 'application/json' }, payload: '{"name":' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });
  it('unexpected error → 500 { error: internal error }, logged scrubbed, no stack', async () => {
    app.get('/boom', async () => { throw new Error(`boom ${SECRET_HOOK}`); });
    const res = await req('GET', '/boom', bence);
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal error' });
    expect(logs.join('\n')).toContain('boom');
    expect(logs.join('\n')).not.toContain('SECRET');
    expect(res.body).not.toContain('SECRET');
  });
});

describe('GET /api/my/deliveries', () => {
  it("returns only the user's deliveries, newest first, with event and parsed breakdown", async () => {
    const bc = addChannel(db, bence);
    addRule(db, bence, { channelIds: [bc] });
    const ac = addChannel(db, anna);
    addRule(db, anna, { channelIds: [ac] });
    const e = (id: string, title: string) => ({ source: 's', externalId: id, category: 'disaster' as const, title, summary: null, url: 'https://x.test', scope: 'country' as const, country: 'HU', severity: 0.9, occurredAt: t0.toISOString(), raw: {} });
    ingest(db, [e('1', 'Old')], t0);
    ingest(db, [e('2', 'New')], new Date(t0.getTime() + 60_000));
    const res = await req('GET', '/api/my/deliveries', bence);
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.map((d: any) => d.event.title)).toEqual(['New', 'Old']);
    expect(items[0]).toEqual({
      id: expect.any(Number), status: 'pending', attempts: 0, lastError: null, createdAt: expect.any(String), sentAt: null,
      channelId: bc, ruleId: expect.any(Number), breakdown: expect.objectContaining({ importance: expect.any(Number), fires: true }),
      event: { id: expect.any(Number), title: 'New', category: 'disaster', country: 'HU', scope: 'country', url: 'https://x.test', occurredAt: t0.toISOString() },
    });
  });
});
