import type { Category, DeliveryStatus, EventRow, Rule, Scope, ScoreBreakdown, User } from '../types';

// Raw SQL rows (snake_case, JSON as TEXT, booleans as 0/1) -> domain types.
export const rowToUser = (r: any): User => ({
  id: r.id, name: r.name, email: r.email, homeCountry: r.home_country, isAdmin: !!r.is_admin,
});

export const rowToRule = (r: any): Rule => ({
  id: r.id, userId: r.user_id, name: r.name,
  categories: JSON.parse(r.categories) as Category[],
  keywords: JSON.parse(r.keywords) as string[],
  threshold: r.threshold,
  channelIds: JSON.parse(r.channel_ids) as number[],
  enabled: !!r.enabled,
});

export const rowToEvent = (r: any): EventRow => ({
  id: r.id, source: r.source, externalId: r.external_id, category: r.category as Category,
  title: r.title, summary: r.summary, url: r.url, country: r.country, scope: r.scope as Scope,
  severity: r.severity, occurredAt: r.occurred_at, raw: JSON.parse(r.raw),
});

export interface ChannelRow { id: number; userId: number; type: string; config: unknown; enabled: boolean }
export const rowToChannel = (r: any): ChannelRow => ({
  id: r.id, userId: r.user_id, type: r.type, config: JSON.parse(r.config), enabled: !!r.enabled,
});

// A deliveries row joined with its event's columns aliased e_* (see GET /api/my/deliveries).
export const rowToDeliveryWithEvent = (r: any) => ({
  id: r.id as number, status: r.status as DeliveryStatus, attempts: r.attempts as number, lastError: r.last_error as string | null,
  createdAt: r.created_at as string, sentAt: r.sent_at as string | null, channelId: r.channel_id as number | null, ruleId: r.rule_id as number | null,
  breakdown: JSON.parse(r.score_breakdown) as ScoreBreakdown,
  event: { id: r.event_id as number, title: r.e_title as string, category: r.e_category as Category, country: r.e_country as string | null, scope: r.e_scope as Scope, url: r.e_url as string | null, occurredAt: r.e_occurred_at as string },
});
