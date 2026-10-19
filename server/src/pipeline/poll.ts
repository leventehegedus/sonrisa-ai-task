import type { Database } from 'better-sqlite3';
import { sourceAdapters } from '../sources';
import { ingest } from './ingest';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_ERROR_LEN = 500;

/** Fetch one source, normalize and ingest it. Never throws: failures land in `sources.last_error`. */
export async function pollSource(db: Database, sourceId: number, deps: { fetchImpl: typeof fetch; now: () => Date }): Promise<{ ok: boolean; inserted: number; error?: string }> {
  let row: any;
  try {
    row = db.prepare(`SELECT * FROM sources WHERE id = ?`).get(sourceId);
  } catch (err) {
    return { ok: false, inserted: 0, error: message(err) };
  }
  if (!row) return { ok: false, inserted: 0, error: 'source not found' };

  let inserted = 0;
  let error: string | null = null;
  try {
    inserted = await fetchAndIngest(db, row, deps);
  } catch (err) {
    error = message(err);
  }
  try {
    db.prepare(`UPDATE sources SET last_polled_at = ?, last_error = ? WHERE id = ?`).run(deps.now().toISOString(), error, sourceId);
  } catch (err) {
    error ??= message(err);
  }
  return error === null ? { ok: true, inserted } : { ok: false, inserted: 0, error };
}

async function fetchAndIngest(db: Database, row: any, deps: { fetchImpl: typeof fetch; now: () => Date }): Promise<number> {
  const adapter = Object.hasOwn(sourceAdapters, row.type) ? sourceAdapters[row.type as keyof typeof sourceAdapters] : undefined;
  if (!adapter) throw new Error(`unknown source type ${row.type}`);
  let parsed;
  try { parsed = adapter.configSchema.safeParse(JSON.parse(row.config)); } catch { parsed = null; }
  if (!parsed?.success) throw new Error('invalid config');
  const config = parsed.data;

  const res = await deps.fetchImpl(adapter.url(config), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'world-alerts/0.1' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // body deliberately not read into the error
  const body = await res.text();
  // normalize throws before ingest on a bad body, and ingest is one transaction: no partial events.
  // First poll of a source is a baseline: store what the feed already has, alert only on later items.
  return ingest(db, adapter.normalize(body, config, deps.now()), deps.now(), { createDeliveries: row.last_polled_at !== null }).inserted.length;
}

const message = (err: unknown): string => String((err as Error)?.message ?? err).slice(0, MAX_ERROR_LEN);
