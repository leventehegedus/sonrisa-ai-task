import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { DELIVERY_EVENT_COLUMNS, rowToDeliveryWithEvent, rowToEvent, rowToRule, rowToSource, rowToUser } from '../db/rows';
import { ingest } from '../pipeline/ingest';
import { pollSource } from '../pipeline/poll';
import { ManualEventInput, manualEvent } from '../sources/manual';
import type { AppDeps } from './app';
import { requireAdmin } from './auth';
import { IdParams, notFound } from './user-routes';

const EventsQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });
const DeliveriesQuery = z.object({ status: z.enum(['pending', 'sent', 'failed']).optional() });
const SourcePatch = z.strictObject({
  enabled: z.boolean().optional(),
  poll_interval_s: z.number().int().min(60).max(86400).optional(),
}).refine((b) => b.enabled !== undefined || b.poll_interval_s !== undefined, 'at least one of enabled, poll_interval_s');
const InjectBody = z.strictObject(ManualEventInput.shape);

// Owner = the rule's user, or the channel's when the rule was deleted (both null only if both are gone).
const rowToAdminDelivery = (r: any) => ({ ...rowToDeliveryWithEvent(r), userId: r.owner_id as number | null });

export function adminRoutes(db: Database, deps: AppDeps) {
  const q = {
    users: db.prepare(`SELECT * FROM users ORDER BY id`),
    rules: db.prepare(`SELECT * FROM rules ORDER BY id`),
    events: db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`),
    // shortcut: newest 500 only, no paging; add cursor paging when the admin UI needs older history
    deliveries: db.prepare(
      `SELECT d.*, COALESCE(r.user_id, c.user_id) AS owner_id, ${DELIVERY_EVENT_COLUMNS}
       FROM deliveries d JOIN events e ON e.id = d.event_id
       LEFT JOIN channels c ON c.id = d.channel_id LEFT JOIN rules r ON r.id = d.rule_id
       WHERE (@status IS NULL OR d.status = @status) AND (@id IS NULL OR d.id = @id)
       ORDER BY d.created_at DESC, d.id DESC LIMIT 500`,
    ),
    deliveryStatus: db.prepare(`SELECT status FROM deliveries WHERE id = ?`),
    retry: db.prepare(`UPDATE deliveries SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL WHERE id = ? AND status = 'failed'`),
    sources: db.prepare(`SELECT * FROM sources ORDER BY id`),
    source: db.prepare(`SELECT * FROM sources WHERE id = ?`),
    updateSource: db.prepare(`UPDATE sources SET enabled = COALESCE(?, enabled), poll_interval_s = COALESCE(?, poll_interval_s) WHERE id = ?`),
  };
  const getDelivery = (id: number) => rowToAdminDelivery(q.deliveries.get({ status: null, id }));

  return async (app: FastifyInstance) => {
    app.addHook('onRequest', requireAdmin);

    app.get('/users', async () => q.users.all().map(rowToUser));

    app.get('/rules', async () => q.rules.all().map(rowToRule));

    app.get('/events', async (req) => q.events.all(EventsQuery.parse(req.query).limit).map(rowToEvent));

    app.post('/events', async (req, reply) => {
      const body = InjectBody.parse(req.body);
      const now = deps.now();
      const { inserted, deliveriesCreated } = ingest(db, [manualEvent(body, now)], now);
      return reply.code(201).send({ event: inserted[0], deliveriesCreated });
    });

    app.get('/deliveries', async (req) =>
      q.deliveries.all({ status: DeliveriesQuery.parse(req.query).status ?? null, id: null }).map(rowToAdminDelivery));

    app.post('/deliveries/:id/retry', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      if (q.retry.run(deps.now().toISOString(), id).changes) return getDelivery(id);
      return q.deliveryStatus.get(id)
        ? reply.code(409).send({ error: 'only failed deliveries can be retried' })
        : reply.code(404).send(notFound);
    });

    app.get('/sources', async () => q.sources.all().map(rowToSource));

    app.patch('/sources/:id', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      const b = SourcePatch.parse(req.body);
      const enabled = b.enabled === undefined ? null : b.enabled ? 1 : 0;
      if (!q.updateSource.run(enabled, b.poll_interval_s ?? null, id).changes) return reply.code(404).send(notFound);
      return rowToSource(q.source.get(id));
    });

    // Manual action: polls even a disabled source. Poll failures are a normal result (200, ok:false).
    app.post('/sources/:id/poll', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      if (!q.source.get(id)) return reply.code(404).send(notFound);
      return pollSource(db, id, deps);
    });
  };
}
