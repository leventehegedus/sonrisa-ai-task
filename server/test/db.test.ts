import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';

function seed(db: ReturnType<typeof openDb>) {
  const user = Number(
    db.prepare(`INSERT INTO users (name, email, home_country, is_admin) VALUES ('a','a@x.io','HU',0)`).run().lastInsertRowid,
  );
  const channel = Number(
    db.prepare(`INSERT INTO channels (user_id, type, config, enabled) VALUES (?, 'email', '{}', 1)`).run(user).lastInsertRowid,
  );
  const rule = Number(
    db
      .prepare(`INSERT INTO rules (user_id, name, categories, keywords, threshold, channel_ids, enabled) VALUES (?, 'r', '[]', '[]', 0.5, '[]', 1)`)
      .run(user).lastInsertRowid,
  );
  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO events (source, external_id, category, title, scope, severity, occurred_at, raw)
     VALUES ('gdacs', 'e1', 'disaster', 't', 'global', 0.5, '2026-01-01T00:00:00Z', '{}')`,
  );
  insertEvent.run();
  const event = Number(db.prepare(`SELECT id FROM events`).pluck().get());
  return { user, channel, rule, event, insertEvent };
}

describe('openDb', () => {
  it('creates all 6 tables', () => {
    const db = openDb(':memory:');
    const names = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).pluck().all() as string[];
    for (const t of ['users', 'channels', 'rules', 'events', 'deliveries', 'sources']) expect(names).toContain(t);
  });

  it('dedups events on (source, external_id)', () => {
    const db = openDb(':memory:');
    const { insertEvent } = seed(db);
    insertEvent.run();
    expect(db.prepare(`SELECT count(*) FROM events`).pluck().get()).toBe(1);
  });

  it('dedups deliveries on (event_id, channel_id)', () => {
    const db = openDb(':memory:');
    const { rule, event, channel } = seed(db);
    const ins = db.prepare(
      `INSERT OR IGNORE INTO deliveries (rule_id, event_id, channel_id, status, score, score_breakdown, created_at)
       VALUES (?, ?, ?, 'pending', 0.9, '{}', '2026-01-01T00:00:00Z')`,
    );
    ins.run(rule, event, channel);
    ins.run(rule, event, channel);
    expect(db.prepare(`SELECT count(*) FROM deliveries`).pluck().get()).toBe(1);
  });

  it('cascades user delete to channels and rules', () => {
    const db = openDb(':memory:');
    const { user } = seed(db);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(user);
    expect(db.prepare(`SELECT count(*) FROM channels`).pluck().get()).toBe(0);
    expect(db.prepare(`SELECT count(*) FROM rules`).pluck().get()).toBe(0);
  });

  it('keeps delivery with NULL channel_id when channel is deleted', () => {
    const db = openDb(':memory:');
    const { rule, event, channel } = seed(db);
    db.prepare(
      `INSERT INTO deliveries (rule_id, event_id, channel_id, status, score, score_breakdown, created_at)
       VALUES (?, ?, ?, 'pending', 0.9, '{}', '2026-01-01T00:00:00Z')`,
    ).run(rule, event, channel);
    db.prepare(`DELETE FROM channels WHERE id = ?`).run(channel);
    const row = db.prepare(`SELECT channel_id FROM deliveries`).get() as { channel_id: number | null };
    expect(row.channel_id).toBeNull();
  });
});
