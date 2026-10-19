import type { Database } from 'better-sqlite3';
import { evaluate } from '../matching';
import { rowToEvent, rowToRule, rowToUser } from '../db/rows';
import type { EventRow, NewEvent } from '../types';

const MAX_EVENT_AGE_MS = 24 * 3600_000;

export function ingest(db: Database, events: NewEvent[], now: Date, opts: { createDeliveries?: boolean } = {}): { inserted: EventRow[]; deliveriesCreated: number } {
  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO events (source, external_id, category, title, summary, url, country, scope, severity, occurred_at, raw)
     VALUES (@source, @externalId, @category, @title, @summary, @url, @country, @scope, @severity, @occurredAt, @raw)
     RETURNING *`,
  );
  const insertDelivery = db.prepare(
    `INSERT OR IGNORE INTO deliveries (rule_id, event_id, channel_id, status, attempts, score, score_breakdown, created_at, next_attempt_at)
     VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
  );
  // Only enabled channels owned by the rule's user may receive deliveries.
  const channelOk = db.prepare(`SELECT 1 FROM channels WHERE id = ? AND user_id = ? AND enabled = 1`);

  return db.transaction(() => {
    const users = new Map(db.prepare(`SELECT * FROM users`).all().map((r) => [(r as any).id as number, rowToUser(r)]));
    const rules = db.prepare(`SELECT * FROM rules WHERE enabled = 1`).all().map(rowToRule);
    const ts = now.toISOString();
    const cutoff = now.getTime() - MAX_EVENT_AGE_MS;
    const inserted: EventRow[] = [];
    let deliveriesCreated = 0;
    for (const e of events) {
      const row = insertEvent.get({ ...e, raw: JSON.stringify(e.raw ?? null) });
      if (!row) continue;
      const event = rowToEvent(row);
      inserted.push(event);
      if (opts.createDeliveries === false || Date.parse(event.occurredAt) < cutoff) continue; // stored, never alerted (§7 backfill guard)
      for (const rule of rules) {
        const user = users.get(rule.userId);
        const b = user && evaluate(rule, user, event);
        if (!b || !b.fires) continue;
        for (const channelId of rule.channelIds) {
          if (!channelOk.get(channelId, rule.userId)) continue;
          deliveriesCreated += insertDelivery.run(rule.id, event.id, channelId, b.importance, JSON.stringify(b), ts, ts).changes;
        }
      }
    }
    return { inserted, deliveriesCreated };
  })();
}
