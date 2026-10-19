import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createChannelRegistry, buildMessage, scrubSecrets, type AlertMessage } from '../src/channels';
import type { EventRow, ScoreBreakdown } from '../src/types';

const msg: AlertMessage = { title: 'Flood in Hungary', summary: 'River rising', url: 'https://example.com/a', category: 'disaster', country: 'HU', importance: 0.9, reason: 'because' };
const SLACK = 'https://hooks.slack.com/services/T0/B0/abcdSECRET1234';
let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(os.tmpdir() + '/wa-'); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
const reg = (o: Partial<Parameters<typeof createChannelRegistry>[0]> = {}) =>
  createChannelRegistry({ outboxDir: path.join(dir, 'outbox'), slackDryRun: false, log: () => {}, ...o });

describe('email', () => {
  it('writes one JSON file in outbox containing the title', async () => {
    await reg().email.send({ to: 'a@x.io' }, msg);
    const files = fs.readdirSync(path.join(dir, 'outbox'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/-a@x\.io\.json$/);
    const body = fs.readFileSync(path.join(dir, 'outbox', files[0]), 'utf8');
    expect(body).toContain('[World Alerts] Flood in Hungary');
    expect(body).toContain('because');
    expect(body).toContain('https://example.com/a');
  });
  it('rejects or sanitizes filename-hostile addresses, never writing outside outbox', async () => {
    const r = reg();
    const parsed = r.email.configSchema.safeParse({ to: 'a/../b@x.io' });
    if (parsed.success) await r.email.send(parsed.data, msg);
    const out = path.join(dir, 'outbox');
    const inOut = fs.existsSync(out) ? fs.readdirSync(out) : [];
    for (const f of inOut) expect(f).not.toMatch(/[\\/]/);
    expect(fs.readdirSync(dir).filter((f) => f !== 'outbox')).toEqual([]);
  });
  it('sanitizes a hostile to directly', async () => {
    await reg().email.send({ to: '../../evil' }, msg);
    expect(fs.readdirSync(dir)).toEqual(['outbox']);
    expect(fs.readdirSync(path.join(dir, 'outbox'))[0]).not.toContain('/');
  });
  it('validates email and returns to unmasked', () => {
    const e = reg().email;
    expect(e.configSchema.safeParse({ to: 'nope' }).success).toBe(false);
    expect(e.maskConfig({ to: 'a@x.io' })).toEqual({ to: 'a@x.io' });
  });
});

describe('slack', () => {
  it('posts { text } once to the url', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    await reg({ fetchImpl: fetchImpl as any }).slack.send({ webhookUrl: SLACK }, msg);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as any;
    expect(url).toBe(SLACK);
    const text = JSON.parse(init.body).text;
    expect(text).toContain('Flood in Hungary');
    expect(text).toContain('because');
    expect(text).toContain('https://example.com/a');
  });
  it('throws on 500 without leaking the webhook url', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 500 }));
    const err = await reg({ fetchImpl: fetchImpl as any }).slack.send({ webhookUrl: SLACK }, msg).catch((e) => e);
    expect(err.message).toBe('Slack responded 500');
    expect(err.message).not.toContain('SECRET');
  });
  it('dry-run logs and does not fetch', async () => {
    const fetchImpl = vi.fn();
    const log = vi.fn();
    await reg({ fetchImpl: fetchImpl as any, slackDryRun: true, log }).slack.send({ webhookUrl: SLACK }, msg);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('Flood in Hungary');
  });
  it('rejects non-slack and http urls', () => {
    const s = reg().slack.configSchema;
    expect(s.safeParse({ webhookUrl: 'http://example.com' }).success).toBe(false);
    expect(s.safeParse({ webhookUrl: 'https://example.com/x' }).success).toBe(false);
    expect(s.safeParse({ webhookUrl: SLACK }).success).toBe(true);
  });
  it('masks to last 4 chars only', () => {
    const m = reg().slack.maskConfig({ webhookUrl: SLACK }) as { webhookUrl: string };
    expect(m.webhookUrl).toBe('https://hooks.slack.com/…/1234');
    expect(m.webhookUrl).not.toContain('SECRET');
  });
});

describe('scrubSecrets', () => {
  const cfg = { webhookUrl: SLACK };
  it('removes every occurrence', () => {
    const out = scrubSecrets(`failed ${SLACK} and again ${SLACK}`, cfg);
    expect(out).not.toContain('SECRET');
    expect(out).toBe('failed *** and again ***');
  });
  it('ignores short values and non-object config', () => {
    expect(scrubSecrets('to a@x.io', { to: 'a@x.io' })).toBe('to a@x.io');
    expect(scrubSecrets(`x ${SLACK}`, null)).toBe(`x ${SLACK}`);
    expect(scrubSecrets(`x ${SLACK}`, SLACK)).toBe(`x ${SLACK}`);
  });
});

describe('buildMessage', () => {
  const ev = { id: 1, source: 's', externalId: 'e', category: 'disaster', title: 'T', summary: null, url: null, scope: 'country', country: 'HU', severity: 0.6667, occurredAt: '2026-01-01T00:00:00Z', raw: {} } as EventRow;
  it('normal reason', () => {
    const b: ScoreBreakdown = { severity: 0.6667, proximity: 0.8, proximityReason: 'global', override: false, importance: 0.5333, threshold: 0.5, fires: true };
    const m = buildMessage(ev, b);
    expect(m.reason).toBe('importance 0.53 = severity 0.67 × 0.8 (global) ≥ threshold 0.5');
    expect(m).toMatchObject({ title: 'T', summary: null, url: null, category: 'disaster', country: 'HU', importance: 0.5333 });
  });
  it('not firing uses <', () => {
    const b: ScoreBreakdown = { severity: 0.6667, proximity: 0.8, proximityReason: 'global', override: false, importance: 0.5333, threshold: 0.6, fires: false };
    expect(buildMessage(ev, b).reason).toBe('importance 0.53 = severity 0.67 × 0.8 (global) < threshold 0.6');
  });
  it('override reason', () => {
    const b: ScoreBreakdown = { severity: 1, proximity: 0.2, proximityReason: 'elsewhere', override: true, importance: 1, threshold: 0.5, fires: true };
    expect(buildMessage(ev, b).reason).toBe('importance 1.00 = critical override (severity 1.00 ≥ 0.9) ≥ threshold 0.5');
  });
});
