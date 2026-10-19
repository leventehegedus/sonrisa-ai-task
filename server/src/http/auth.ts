import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from 'better-sqlite3';
import { rowToUser } from '../db/rows';
import type { User } from '../types';

declare module 'fastify' {
  interface FastifyRequest { user: User }
}

/** Strict positive integer from a header or path segment ("1abc", "0", "-1", "1.5" → null). */
export const POSITIVE_INT = /^[1-9]\d{0,14}$/; // <= 15 digits stays a safe integer
export const positiveInt = (s: unknown): number | null =>
  typeof s === 'string' && POSITIVE_INT.test(s) ? Number(s) : null;

// shortcut: header identity, not authentication; replace with real auth before any deployment
export function authenticate(db: Database) {
  const getUser = db.prepare(`SELECT * FROM users WHERE id = ?`);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const id = positiveInt(req.headers['x-user-id']);
    const row = id === null ? undefined : getUser.get(id);
    if (!row) return reply.code(401).send({ error: 'unknown or missing X-User-Id' });
    req.user = rowToUser(row);
  };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.isAdmin) return reply.code(403).send({ error: 'admin only' });
}
