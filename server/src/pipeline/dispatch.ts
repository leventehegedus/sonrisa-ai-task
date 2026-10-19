import type { Database } from 'better-sqlite3';
import { buildMessage, scrubSecrets, type ChannelAdapter } from '../channels';
import { rowToEvent } from '../db/rows';
import type { ScoreBreakdown } from '../types';

export const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 30_000;
const BATCH = 50;

export async function dispatchPending(db: Database, registry: Record<string, ChannelAdapter<any>>, now: Date): Promise<{ sent: number; failed: number; retried: number }> {
  const ts = now.toISOString();
  const due = db.prepare(
    `SELECT d.*, c.type AS c_type, c.config AS c_config, c.enabled AS c_enabled
     FROM deliveries d LEFT JOIN channels c ON c.id = d.channel_id
     WHERE d.status = 'pending' AND d.next_attempt_at <= ? ORDER BY d.next_attempt_at, d.id LIMIT ${BATCH}`,
  ).all(ts) as any[];
  const getEvent = db.prepare(`SELECT * FROM events WHERE id = ?`);
  const markFailed = db.prepare(`UPDATE deliveries SET status = 'failed', last_error = ? WHERE id = ?`);
  const markSent = db.prepare(`UPDATE deliveries SET status = 'sent', sent_at = ?, last_error = NULL, attempts = attempts + 1 WHERE id = ?`);
  const markError = db.prepare(`UPDATE deliveries SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?`);
  const out = { sent: 0, failed: 0, retried: 0 };

  for (const d of due) {
    const fail = (why: string) => { markFailed.run(why, d.id); out.failed++; };
    if (d.channel_id === null) { fail('channel deleted'); continue; }
    if (!d.c_enabled) { fail('channel disabled'); continue; }
    const adapter = registry[d.c_type];
    if (!adapter) { fail(`unknown channel type ${d.c_type}`); continue; }
    let parsed;
    try { parsed = adapter.configSchema.safeParse(JSON.parse(d.c_config)); } catch { parsed = null; }
    if (!parsed?.success) { fail('invalid channel config'); continue; }
    const config = parsed.data;

    let msg;
    try { msg = buildMessage(rowToEvent(getEvent.get(d.event_id)), JSON.parse(d.score_breakdown) as ScoreBreakdown); } catch { fail('corrupt delivery data'); continue; }

    try {
      await adapter.send(config, msg);
    } catch (err: any) {
      const attempts = d.attempts + 1;
      const last = scrubSecrets(String(err?.message ?? err), config);
      if (attempts >= MAX_ATTEMPTS) { markError.run('failed', attempts, last, d.next_attempt_at, d.id); out.failed++; }
      else {
        markError.run('pending', attempts, last, new Date(now.getTime() + BASE_BACKOFF_MS * 2 ** (attempts - 1)).toISOString(), d.id);
        out.retried++;
      }
      continue;
    }
    // Outside the send try: a DB error here must not be routed into retry (would duplicate the alert).
    markSent.run(ts, d.id);
    out.sent++;
  }
  return out;
}
