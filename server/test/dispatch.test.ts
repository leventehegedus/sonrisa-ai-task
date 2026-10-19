import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { dispatchPending, MAX_ATTEMPTS } from '../src/pipeline/dispatch';
import { ingest } from '../src/pipeline/ingest';
import type { ChannelAdapter, AlertMessage } from '../src/channels';
import { addChannel, addRule, addUser, makeDb } from './helpers';
import type { NewEvent } from '../src/types';

const t0 = new Date('2026-10-19T12:00:00Z');
const plus = (d: Date, s: number) => new Date(d.getTime() + s * 1000);
const ev = (o: Partial<NewEvent> = {}): NewEvent => ({
  source: 's', externalId: 'e1', category: 'news', title: 'Hello', summary: null, url: null,
  scope: 'country', country: 'HU', severity: 0.5, occurredAt: '2026-10-19T00:00:00Z', raw: {}, ...o,
});
const SECRET = 'https://hooks.slack.com/services/T000/B000/SECRETSECRET';

function fake(impl: (cfg: any, msg: AlertMessage) => Promise<void>) {
  const calls: AlertMessage[] = [];
  const adapter: ChannelAdapter<any> = {
    type: 'email', configSchema: z.object({ to: z.string() }).loose(), maskConfig: (c) => c,
    send: async (c, m) => { calls.push(m); await impl(c, m); },
  };
  return { adapter, calls, registry: { email: adapter } as Record<string, ChannelAdapter<any>> };
}
function setup(config?: unknown) {
  const db = makeDb();
  const user = addUser(db);
  const channel = addChannel(db, user, config === undefined ? {} : { config });
  addRule(db, user, { channelIds: [channel] });
  ingest(db, [ev()], t0);
  const d = () => db.prepare(`SELECT * FROM deliveries`).get() as any;
  return { db, user, channel, d };
}

describe('dispatchPending', () => {
  it('sends a due delivery and marks it sent', async () => {
    const { db, d } = setup();
    const f = fake(async () => {});
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 1, failed: 0, retried: 0 });
    expect(f.calls[0].title).toBe('Hello');
    expect(d()).toMatchObject({ status: 'sent', attempts: 1, last_error: null, sent_at: t0.toISOString() });
  });

  it('retries with 30s then 60s backoff and fails at MAX_ATTEMPTS', async () => {
    const { db, d } = setup();
    const f = fake(async () => { throw new Error('boom'); });
    expect(MAX_ATTEMPTS).toBe(3);
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 0, failed: 0, retried: 1 });
    expect(d()).toMatchObject({ status: 'pending', attempts: 1, last_error: 'boom', next_attempt_at: plus(t0, 30).toISOString() });
    // not yet due
    expect(await dispatchPending(db, f.registry, plus(t0, 29))).toEqual({ sent: 0, failed: 0, retried: 0 });
    const t1 = plus(t0, 30);
    expect(await dispatchPending(db, f.registry, t1)).toEqual({ sent: 0, failed: 0, retried: 1 });
    expect(d()).toMatchObject({ status: 'pending', attempts: 2, next_attempt_at: plus(t1, 60).toISOString() });
    expect(await dispatchPending(db, f.registry, plus(t1, 60))).toEqual({ sent: 0, failed: 1, retried: 0 });
    expect(d()).toMatchObject({ status: 'failed', attempts: 3, last_error: 'boom' });
    expect(f.calls).toHaveLength(3);
  });

  it('skips a delivery whose next_attempt_at is in the future', async () => {
    const { db, d } = setup();
    db.prepare(`UPDATE deliveries SET next_attempt_at = ?`).run(plus(t0, 10).toISOString());
    const f = fake(async () => {});
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 0, failed: 0, retried: 0 });
    expect(f.calls).toHaveLength(0);
    expect(d().status).toBe('pending');
  });

  it('fails a delivery whose channel was deleted, without sending', async () => {
    const { db, channel, d } = setup();
    db.prepare(`DELETE FROM channels WHERE id = ?`).run(channel);
    const f = fake(async () => {});
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 0, failed: 1, retried: 0 });
    expect(d()).toMatchObject({ status: 'failed', last_error: 'channel deleted', attempts: 0 });
    expect(f.calls).toHaveLength(0);
  });

  it('fails permanently for a disabled channel, unknown type, or invalid config', async () => {
    const f = fake(async () => {});
    const a = setup(); a.db.prepare(`UPDATE channels SET enabled = 0`).run();
    expect(await dispatchPending(a.db, f.registry, t0)).toEqual({ sent: 0, failed: 1, retried: 0 });
    expect(a.d()).toMatchObject({ status: 'failed', last_error: 'channel disabled', attempts: 0 });
    const b = setup(); b.db.prepare(`UPDATE channels SET type = 'sms'`).run();
    await dispatchPending(b.db, f.registry, t0);
    expect(b.d()).toMatchObject({ status: 'failed', last_error: 'unknown channel type sms', attempts: 0 });
    const c = setup({ to: 5 });
    await dispatchPending(c.db, f.registry, t0);
    expect(c.d()).toMatchObject({ status: 'failed', last_error: 'invalid channel config', attempts: 0 });
    expect(f.calls).toHaveLength(0);
  });

  it('stores error messages scrubbed of the webhook url', async () => {
    const { db, d } = setup({ to: 'x@example.com', webhookUrl: SECRET });
    const f = fake(async () => { throw new Error(`POST ${SECRET} failed`); });
    await dispatchPending(db, f.registry, t0);
    expect(d().last_error).toBe('POST *** failed');
    expect(d().last_error).not.toContain('SECRETSECRET');
  });

  it('a throwing adapter does not abort the remaining deliveries', async () => {
    const { db } = setup();
    ingest(db, [ev({ externalId: 'e2', title: 'Second' })], t0);
    let n = 0;
    const f = fake(async () => { if (n++ === 0) throw new Error('first dies'); });
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 1, failed: 0, retried: 1 });
    const rows = db.prepare(`SELECT status FROM deliveries ORDER BY id`).all() as any[];
    expect(rows.map((r) => r.status)).toEqual(['pending', 'sent']);
  });

  it('does not retry (no duplicate send) when marking sent fails after a successful send', async () => {
    const { db, d } = setup();
    db.exec(`CREATE TRIGGER no_sent BEFORE UPDATE ON deliveries WHEN NEW.status = 'sent' BEGIN SELECT RAISE(ABORT, 'disk full'); END`);
    const f = fake(async () => {});
    await expect(dispatchPending(db, f.registry, t0)).rejects.toThrow('disk full');
    expect(f.calls).toHaveLength(1);
    expect(d()).toMatchObject({ status: 'pending', attempts: 0, last_error: null, next_attempt_at: t0.toISOString() });
  });

  it('fails immediately as corrupt when score_breakdown is not JSON', async () => {
    const { db, d } = setup();
    db.prepare(`UPDATE deliveries SET score_breakdown = '{not json'`).run();
    const f = fake(async () => {});
    expect(await dispatchPending(db, f.registry, t0)).toEqual({ sent: 0, failed: 1, retried: 0 });
    expect(d()).toMatchObject({ status: 'failed', last_error: 'corrupt delivery data', attempts: 0 });
    expect(f.calls).toHaveLength(0);
  });
});
