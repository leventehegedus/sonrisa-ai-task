import type { Category, EventRow, Rule, Scope, User } from '../types';

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
