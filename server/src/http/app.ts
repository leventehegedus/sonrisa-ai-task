import Fastify, { type FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import type { ChannelAdapter } from '../channels';
import { authenticate } from './auth';
import { userRoutes } from './user-routes';

export interface AppDeps { registry: Record<string, ChannelAdapter<any>>; fetchImpl: typeof fetch; now: () => Date; log: (msg: string) => void }

// Errors have no channel config at hand, so mask by pattern: Slack webhook paths and URL credentials.
const scrub = (s: string) => s
  .replace(/https:\/\/hooks\.slack\.com\/\S*/g, 'https://hooks.slack.com/***')
  .replace(/\/\/[^\s/@:]+:[^\s/@]+@/g, '//***@');

export function buildApp(db: Database, deps: AppDeps): FastifyInstance {
  const app = Fastify();
  app.decorateRequest('user', null as any);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'invalid request', issues: err.issues });
    const e = err as { statusCode?: number; code?: string; message?: string };
    // Fastify's own client errors (malformed JSON, wrong content type, body too large).
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.message, code: e.code });
    deps.log(`http error: ${scrub(e.message ?? String(err))}`);
    return reply.code(500).send({ error: 'internal error' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not found' }));

  app.register(async (api) => {
    api.addHook('preHandler', authenticate(db));
    await api.register(userRoutes(db, deps));
  }, { prefix: '/api' });
  return app;
}
