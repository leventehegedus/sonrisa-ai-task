import type { Database } from 'better-sqlite3';
import type { ChannelAdapter } from '../channels';
import { dispatchPending } from './dispatch';
import { pollSource } from './poll';

const TICK_MS = 10_000;

export interface SchedulerDeps { fetchImpl: typeof fetch; registry: Record<string, ChannelAdapter<any>>; now: () => Date; log: (msg: string) => void }

/** One scheduler tick: poll due sources sequentially, then dispatch. Never rejects. */
export async function runTick(db: Database, deps: SchedulerDeps): Promise<{ polled: number; dispatch?: { sent: number; failed: number; retried: number } }> {
  let polled = 0;
  try {
    const due = db.prepare(
      `SELECT id, name FROM sources
       WHERE enabled = 1 AND (last_polled_at IS NULL OR julianday(last_polled_at) <= julianday(?) - poll_interval_s / 86400.0)
       ORDER BY id`,
    ).all(deps.now().toISOString()) as { id: number; name: string }[];
    for (const s of due) {
      const r = await pollSource(db, s.id, deps);
      polled++;
      if (!r.ok) deps.log(`poll failed: source ${s.id} (${s.name}): ${r.error}`);
    }
  } catch (err) {
    deps.log(`poll error: ${(err as Error)?.message ?? err}`);
  }
  try {
    return { polled, dispatch: await dispatchPending(db, deps.registry, deps.now()) };
  } catch (err) {
    deps.log(`dispatch error: ${(err as Error)?.message ?? err}`);
    return { polled };
  }
}

export function startScheduler(db: Database, deps: SchedulerDeps): { stop(): void } {
  let running = false;
  const tick = async () => {
    if (running) return; // previous tick still in flight
    running = true;
    try { await runTick(db, deps); } finally { running = false; }
  };
  // runTick only rejects if deps.log itself throws; swallow it so it can't become an unhandled rejection (process exit).
  const safeTick = () => { tick().catch(() => {}); };
  safeTick();
  const timer = setInterval(safeTick, TICK_MS);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
