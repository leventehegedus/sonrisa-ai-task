import { describe, it, expect } from 'vitest';
import { ingest } from '../src/pipeline/ingest';
import { addChannel, addRule, addUser, makeDb } from './helpers';
import type { NewEvent } from '../src/types';

const now = new Date('2026-10-19T12:00:00Z');
const ev = (o: Partial<NewEvent> = {}): NewEvent => ({
  source: 's', externalId: 'e1', category: 'news', title: 'Hello', summary: null, url: null,
  scope: 'country', country: 'HU', severity: 0.5, occurredAt: '2026-10-19T00:00:00Z', raw: {}, ...o,
});
const deliveries = (db: ReturnType<typeof makeDb>) => db.prepare(`SELECT * FROM deliveries`).all() as any[];

function setup() {
  const db = makeDb();
  const user = addUser(db, { homeCountry: 'HU' });
  const channel = addChannel(db, user);
  const rule = addRule(db, user, { channelIds: [channel] });
  return { db, user, channel, rule };
}

describe('ingest', () => {
  it('creates a pending scored delivery for a HU event and HU user', () => {
    const { db, channel, rule } = setup();
    const r = ingest(db, [ev()], now);
    expect(r.inserted).toHaveLength(1);
    expect(r.deliveriesCreated).toBe(1);
    const [d] = deliveries(db);
    expect(d).toMatchObject({ status: 'pending', attempts: 0, rule_id: rule, channel_id: channel, event_id: r.inserted[0].id,
      score: 0.5, created_at: now.toISOString(), next_attempt_at: now.toISOString() });
    expect(JSON.parse(d.score_breakdown).proximityReason).toBe('home');
  });

  it('re-ingesting the same event inserts nothing and keeps one delivery', () => {
    const { db } = setup();
    ingest(db, [ev()], now);
    const r = ingest(db, [ev()], now);
    expect(r.inserted).toEqual([]);
    expect(r.deliveriesCreated).toBe(0);
    expect(deliveries(db)).toHaveLength(1);
  });

  it('two rules matching on the same channel give one delivery', () => {
    const { db, user, channel } = setup();
    addRule(db, user, { name: 'second', channelIds: [channel] });
    const r = ingest(db, [ev()], now);
    expect(deliveries(db)).toHaveLength(1);
    expect(r.deliveriesCreated).toBe(1);
  });

  it('a NP event for a HU user gives no delivery', () => {
    const { db } = setup();
    const r = ingest(db, [ev({ country: 'NP' })], now);
    expect(r.inserted).toHaveLength(1);
    expect(deliveries(db)).toHaveLength(0);
  });

  it('a disabled channel gets no delivery', () => {
    const { db, user } = setup();
    const off = addChannel(db, user, { enabled: false });
    db.prepare(`UPDATE rules SET channel_ids = ?`).run(JSON.stringify([off]));
    ingest(db, [ev()], now);
    expect(deliveries(db)).toHaveLength(0);
  });

  it('a rule never delivers to another user\'s channel', () => {
    const { db, user } = setup();
    const other = addUser(db, { email: 'o@example.com' });
    const foreign = addChannel(db, other);
    db.prepare(`UPDATE rules SET channel_ids = ? WHERE user_id = ?`).run(JSON.stringify([foreign]), user);
    ingest(db, [ev()], now);
    expect(deliveries(db)).toHaveLength(0);
  });

  it('a nonexistent channel id gets no delivery and no NULL channel_id row', () => {
    const { db, user } = setup();
    db.prepare(`UPDATE rules SET channel_ids = '[9999]' WHERE user_id = ?`).run(user);
    ingest(db, [ev()], now);
    expect(deliveries(db)).toHaveLength(0);
  });

  it('a disabled rule gets no delivery', () => {
    const { db } = setup();
    db.prepare(`UPDATE rules SET enabled = 0`).run();
    ingest(db, [ev()], now);
    expect(deliveries(db)).toHaveLength(0);
  });
});
