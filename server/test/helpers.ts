import { openDb } from '../src/db';
import type { Category } from '../src/types';

type Db = ReturnType<typeof openDb>;

export const makeDb = (): Db => openDb(':memory:');

// Factories insert one row and return its id.
export function addUser(db: Db, o: { name?: string; email?: string; homeCountry?: string; isAdmin?: boolean } = {}): number {
  return Number(db.prepare(`INSERT INTO users (name, email, home_country, is_admin) VALUES (?, ?, ?, ?)`)
    .run(o.name ?? 'User', o.email ?? 'u@example.com', o.homeCountry ?? 'HU', o.isAdmin ? 1 : 0).lastInsertRowid);
}

export function addChannel(db: Db, userId: number, o: { type?: 'email' | 'slack'; config?: unknown; enabled?: boolean } = {}): number {
  return Number(db.prepare(`INSERT INTO channels (user_id, type, config, enabled) VALUES (?, ?, ?, ?)`)
    .run(userId, o.type ?? 'email', JSON.stringify(o.config ?? { to: 'u@example.com' }), o.enabled === false ? 0 : 1).lastInsertRowid);
}

export function addRule(
  db: Db, userId: number,
  o: { name?: string; categories?: Category[]; keywords?: string[]; threshold?: number; channelIds?: number[]; enabled?: boolean } = {},
): number {
  return Number(db.prepare(`INSERT INTO rules (user_id, name, categories, keywords, threshold, channel_ids, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, o.name ?? 'rule', JSON.stringify(o.categories ?? []), JSON.stringify(o.keywords ?? []),
      o.threshold ?? 0.5, JSON.stringify(o.channelIds ?? []), o.enabled === false ? 0 : 1).lastInsertRowid);
}
