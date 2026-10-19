import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { buildMessage, scrubSecrets } from '../channels';
import { DELIVERY_EVENT_COLUMNS, rowToChannel, rowToDeliveryWithEvent, rowToRule, type ChannelRow } from '../db/rows';
import { score } from '../scoring';
import type { EventRow, User } from '../types';
import type { AppDeps } from './app';
import { POSITIVE_INT } from './auth';

export const IdParams = z.object({ id: z.string().regex(POSITIVE_INT, 'must be a positive integer').transform(Number) });

const ruleFields = {
  name: z.string().min(1).max(100),
  categories: z.array(z.enum(['news', 'market', 'disaster'])),
  keywords: z.array(z.string().min(1).max(50)).max(20),
  threshold: z.number().min(0).max(1),
  channelIds: z.array(z.number().int().positive()),
  enabled: z.boolean(),
};
const RuleCreate = z.strictObject({
  ...ruleFields,
  categories: ruleFields.categories.default([]),
  keywords: ruleFields.keywords.default([]),
  threshold: ruleFields.threshold.default(0.5),
  channelIds: ruleFields.channelIds.default([]),
  enabled: ruleFields.enabled.default(true),
});
const RulePatch = z.strictObject(ruleFields).partial();
const ChannelCreate = z.strictObject({ type: z.string(), config: z.unknown().optional(), enabled: z.boolean().default(true) });
const ChannelPatch = z.strictObject({ config: z.unknown().optional(), enabled: z.boolean().optional() });

const badRequest = (path: string, message: string) => ({ error: 'invalid request', issues: [{ path: [path], message }] });
export const notFound = { error: 'not found' };
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function userRoutes(db: Database, deps: AppDeps) {
  const { registry } = deps;
  const q = {
    users: db.prepare(`SELECT id, name FROM users ORDER BY id`),
    rules: db.prepare(`SELECT * FROM rules WHERE user_id = ? ORDER BY id`),
    rule: db.prepare(`SELECT * FROM rules WHERE id = ? AND user_id = ?`),
    insertRule: db.prepare(`INSERT INTO rules (user_id, name, categories, keywords, threshold, channel_ids, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    updateRule: db.prepare(`UPDATE rules SET name = ?, categories = ?, keywords = ?, threshold = ?, channel_ids = ?, enabled = ? WHERE id = ?`),
    setRuleChannels: db.prepare(`UPDATE rules SET channel_ids = ? WHERE id = ?`),
    deleteRule: db.prepare(`DELETE FROM rules WHERE id = ? AND user_id = ?`),
    channels: db.prepare(`SELECT * FROM channels WHERE user_id = ? ORDER BY id`),
    channel: db.prepare(`SELECT * FROM channels WHERE id = ? AND user_id = ?`),
    insertChannel: db.prepare(`INSERT INTO channels (user_id, type, config, enabled) VALUES (?, ?, ?, ?)`),
    updateChannel: db.prepare(`UPDATE channels SET config = ?, enabled = ? WHERE id = ?`),
    deleteChannel: db.prepare(`DELETE FROM channels WHERE id = ?`),
    deliveries: db.prepare(
      `SELECT d.*, ${DELIVERY_EVENT_COLUMNS}
       FROM deliveries d JOIN events e ON e.id = d.event_id
       LEFT JOIN channels c ON c.id = d.channel_id LEFT JOIN rules r ON r.id = d.rule_id
       WHERE c.user_id = ? OR r.user_id = ?
       ORDER BY d.created_at DESC, d.id DESC LIMIT 100`, // shortcut: fixed LIMIT 100, add pagination when history grows
    ),
  };

  const getRule = (id: number, user: User) => { const r = q.rule.get(id, user.id); return r ? rowToRule(r) : null; };
  const getChannel = (id: number, user: User) => { const r = q.channel.get(id, user.id); return r ? rowToChannel(r) : null; };
  const ownsAll = (ids: number[], user: User) => ids.every((id) => q.channel.get(id, user.id));
  const masked = (c: ChannelRow) => ({ id: c.id, type: c.type, config: registry[c.type]?.maskConfig(c.config) ?? {}, enabled: c.enabled });
  /** Validates with the adapter schema (throws ZodError → 400). Email `to` defaults to the user's email. */
  const parseConfig = (type: string, config: unknown, user: User) => {
    const raw = type === 'email' && (config === undefined || isObject(config)) ? { to: user.email, ...(config ?? {}) } : config;
    return registry[type].configSchema.parse(raw);
  };

  return async (app: FastifyInstance) => {
    app.get('/me', async (req) => req.user);

    app.get('/users', async () => q.users.all());

    app.get('/rules', async (req) => q.rules.all(req.user.id).map(rowToRule));

    app.get('/rules/:id', async (req, reply) => getRule(IdParams.parse(req.params).id, req.user) ?? reply.code(404).send(notFound));

    app.post('/rules', async (req, reply) => {
      const b = RuleCreate.parse(req.body);
      const channelIds = [...new Set(b.channelIds)];
      if (!ownsAll(channelIds, req.user)) return reply.code(400).send(badRequest('channelIds', 'unknown channel'));
      const id = Number(q.insertRule.run(req.user.id, b.name, JSON.stringify(b.categories), JSON.stringify(b.keywords),
        b.threshold, JSON.stringify(channelIds), b.enabled ? 1 : 0).lastInsertRowid);
      return reply.code(201).send(getRule(id, req.user));
    });

    app.patch('/rules/:id', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      const b = RulePatch.parse(req.body);
      const cur = getRule(id, req.user);
      if (!cur) return reply.code(404).send(notFound);
      const next = { ...cur, ...b, channelIds: [...new Set(b.channelIds ?? cur.channelIds)] };
      if (b.channelIds && !ownsAll(next.channelIds, req.user)) return reply.code(400).send(badRequest('channelIds', 'unknown channel'));
      q.updateRule.run(next.name, JSON.stringify(next.categories), JSON.stringify(next.keywords), next.threshold,
        JSON.stringify(next.channelIds), next.enabled ? 1 : 0, id);
      return getRule(id, req.user);
    });

    app.delete('/rules/:id', async (req, reply) => {
      const { changes } = q.deleteRule.run(IdParams.parse(req.params).id, req.user.id);
      return changes ? reply.code(204).send() : reply.code(404).send(notFound);
    });

    app.get('/channels', async (req) => q.channels.all(req.user.id).map((r) => masked(rowToChannel(r))));

    app.get('/channels/:id', async (req, reply) => {
      const c = getChannel(IdParams.parse(req.params).id, req.user);
      return c ? masked(c) : reply.code(404).send(notFound);
    });

    app.post('/channels', async (req, reply) => {
      const b = ChannelCreate.parse(req.body);
      if (!Object.hasOwn(registry, b.type)) return reply.code(400).send(badRequest('type', `unknown channel type, expected one of: ${Object.keys(registry).join(', ')}`));
      const config = parseConfig(b.type, b.config, req.user);
      const id = Number(q.insertChannel.run(req.user.id, b.type, JSON.stringify(config), b.enabled ? 1 : 0).lastInsertRowid);
      return reply.code(201).send(masked(getChannel(id, req.user)!));
    });

    app.patch('/channels/:id', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      const b = ChannelPatch.parse(req.body);
      const cur = getChannel(id, req.user);
      if (!cur) return reply.code(404).send(notFound);
      if (!Object.hasOwn(registry, cur.type)) return reply.code(400).send(badRequest('type', 'channel type no longer supported'));
      const config = b.config === undefined ? cur.config : parseConfig(cur.type, b.config, req.user);
      q.updateChannel.run(JSON.stringify(config), (b.enabled ?? cur.enabled) ? 1 : 0, id);
      return masked(getChannel(id, req.user)!);
    });

    // Rules drop the id in the same transaction; deliveries keep their history (channel_id ON DELETE SET NULL).
    const deleteChannel = db.transaction((id: number, user: User) => {
      for (const r of q.rules.all(user.id).map(rowToRule))
        if (r.channelIds.includes(id)) q.setRuleChannels.run(JSON.stringify(r.channelIds.filter((c) => c !== id)), r.id);
      q.deleteChannel.run(id);
    });
    app.delete('/channels/:id', async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      if (!getChannel(id, req.user)) return reply.code(404).send(notFound);
      deleteChannel(id, req.user);
      return reply.code(204).send();
    });

    // Explicit user action: sends even if the channel is disabled, skipping the outbox.
    app.post('/channels/:id/test', async (req, reply) => {
      const c = getChannel(IdParams.parse(req.params).id, req.user);
      if (!c) return reply.code(404).send(notFound);
      const adapter = Object.hasOwn(registry, c.type) ? registry[c.type] : undefined;
      if (!adapter) return { ok: false, error: `unknown channel type ${c.type}` };
      const parsed = adapter.configSchema.safeParse(c.config);
      if (!parsed.success) return { ok: false, error: 'invalid channel config' };
      const event: EventRow = {
        id: 0, source: 'test', externalId: 'test', category: 'news', title: 'World Alerts test message',
        summary: 'This is a test alert sent from your channel settings.', url: null, scope: 'global', country: null,
        severity: 1, occurredAt: deps.now().toISOString(), raw: {},
      };
      try {
        await adapter.send(parsed.data, buildMessage(event, score(event, req.user.homeCountry, 0.5)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: scrubSecrets(err instanceof Error ? err.message : String(err), c.config) };
      }
    });

    app.get('/my/deliveries', async (req) => q.deliveries.all(req.user.id, req.user.id).map(rowToDeliveryWithEvent));
  };
}
