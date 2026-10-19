import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { lookupCountry } from '../geo';
import type { NewEvent } from '../types';

export const ManualEventInput = z.object({
  category: z.enum(['news', 'market', 'disaster']),
  title: z.string().trim().min(1),
  summary: z.string().optional(),
  url: z.url({ protocol: /^https?$/ }).optional(),
  country: z.string().refine((c) => !!lookupCountry(c), 'unknown ISO2 country').optional(),
  severity: z.number().min(0).max(1),
});
export type ManualEventInput = z.infer<typeof ManualEventInput>;

export function manualEvent(input: ManualEventInput, now: Date): NewEvent {
  return {
    source: 'manual',
    externalId: `manual:${randomUUID()}`,
    category: input.category,
    title: input.title,
    summary: input.summary || null,
    url: input.url ?? null,
    scope: input.country ? 'country' : 'global',
    country: input.country ?? null,
    severity: input.severity,
    occurredAt: now.toISOString(),
    raw: input,
  };
}
