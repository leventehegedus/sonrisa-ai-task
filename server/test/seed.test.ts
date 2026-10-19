import { describe, it, expect } from 'vitest';
import { seed } from '../src/db/seed';
import { rowToRule, rowToUser } from '../src/db/rows';
import { sourceAdapters } from '../src/sources';
import { makeDb } from './helpers';

const HOOK = 'https://hooks.slack.com/services/T0/B0/seedSECRET';

describe('seed', () => {
  it('creates users, channels, default rules and sources', () => {
    const db = makeDb();
    seed(db);
    const users = (db.prepare(`SELECT * FROM users ORDER BY id`).all()).map(rowToUser);
    expect(users.map((u) => [u.name, u.homeCountry, u.isAdmin])).toEqual([['Anna', 'HU', true], ['Bence', 'HU', false], ['Priya', 'NP', false]]);

    const channels = db.prepare(`SELECT * FROM channels ORDER BY id`).all() as any[];
    expect(channels.map((c) => c.type)).toEqual(['email', 'email', 'email']);
    for (const u of users) {
      const ch = channels.find((c) => c.user_id === u.id)!;
      expect(JSON.parse(ch.config)).toEqual({ to: u.email });
      const rules = db.prepare(`SELECT * FROM rules WHERE user_id = ?`).all(u.id).map(rowToRule);
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ categories: [], keywords: [], threshold: 0.5, channelIds: [ch.id], enabled: true });
    }

    const sources = db.prepare(`SELECT * FROM sources ORDER BY id`).all() as any[];
    expect(sources.map((s) => [s.type, JSON.parse(s.config).feedId ?? null, JSON.parse(s.config).country ?? null])).toEqual([
      ['gdacs', null, null], ['coingecko', null, null], ['rss', 'telex', 'HU'], ['rss', 'hvg', 'HU'], ['rss', 'bbc-world', null],
    ]);
    for (const s of sources) {
      expect(s.poll_interval_s).toBe(300);
      expect(s.enabled).toBe(1);
      const adapter = sourceAdapters[s.type as keyof typeof sourceAdapters];
      expect(adapter.configSchema.safeParse(JSON.parse(s.config)).success, s.name).toBe(true);
    }
  });

  it('is idempotent: running twice still gives 3 users', () => {
    const db = makeDb();
    seed(db);
    seed(db);
    const n = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any).n;
    expect([n('users'), n('channels'), n('rules'), n('sources')]).toEqual([3, 3, 3, 5]);
  });

  it('gives Bence a slack channel on his rule only when a webhook is provided', () => {
    const db = makeDb();
    seed(db, { slackWebhook: HOOK });
    const bence = db.prepare(`SELECT id FROM users WHERE name = 'Bence'`).get() as any;
    const slack = db.prepare(`SELECT * FROM channels WHERE type = 'slack'`).all() as any[];
    expect(slack).toHaveLength(1);
    expect(slack[0].user_id).toBe(bence.id);
    expect(JSON.parse(slack[0].config)).toEqual({ webhookUrl: HOOK });
    const rule = rowToRule(db.prepare(`SELECT * FROM rules WHERE user_id = ?`).get(bence.id));
    expect(rule.channelIds).toContain(slack[0].id);
    expect(rule.channelIds).toHaveLength(2);
  });
});
