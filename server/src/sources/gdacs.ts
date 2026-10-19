import { z } from 'zod';
import { iso3ToIso2 } from '../geo';
import type { NewEvent } from '../types';
import type { SourceAdapter } from './index';
import { cleanText, isoDate, parseRssItems, text } from './rss';

const SEVERITY: Record<string, number> = { Green: 0.3, Orange: 0.7, Red: 1.0 };

export const gdacs: SourceAdapter<Record<string, never>> = {
  type: 'gdacs',
  configSchema: z.object({}).strict() as z.ZodType<Record<string, never>>,
  url: () => 'https://www.gdacs.org/xml/rss.xml',
  normalize(body, _config, now) {
    return parseRssItems(body, 'gdacs').map((item): NewEvent => {
      const eventId = text(item['gdacs:eventid']);
      const level = text(item['gdacs:alertlevel']);
      const severity = SEVERITY[level];
      if (!eventId || severity === undefined) throw new Error(`gdacs: item missing eventid or unknown alertlevel '${level}'`);
      const country = iso3ToIso2(text(item['gdacs:iso3'])) ?? null;
      return {
        source: 'gdacs',
        externalId: `${eventId}:${level}`,
        category: 'disaster',
        title: cleanText(text(item.title)) ?? '',
        summary: cleanText(text(item.description)),
        url: text(item.link) || null,
        scope: country ? 'country' : 'unknown',
        country,
        severity,
        occurredAt: isoDate(text(item.pubDate), now),
        raw: item,
      };
    });
  },
};
