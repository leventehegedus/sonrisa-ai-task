import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { lookupCountry } from '../geo';
import type { NewEvent } from '../types';
import type { SourceAdapter } from './index';

export interface RssConfig { feedId: string; url: string; country: string | null; breakingKeywords: string[] }

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false, // keep ids/titles as strings ("2026" must not become a number)
  isArray: (name, jpath) => name === 'item' && jpath === 'rss.channel.item',
});

/** Parse an RSS 2.0 body into its <item> objects. Throws if there is no rss.channel. */
export function parseRssItems(body: string, label: string): Record<string, unknown>[] {
  let doc: any;
  try {
    doc = parser.parse(body);
  } catch (err) {
    throw new Error(`${label}: unparseable XML (${(err as Error).message})`);
  }
  const channel = doc?.rss?.channel;
  if (!channel || typeof channel !== 'object') throw new Error(`${label}: no rss.channel in body`);
  return channel.item ?? [];
}

/** Text content of a parsed node: plain string, or `{ '#text': ... }` when the tag has attributes. */
export function text(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'object') return text((node as Record<string, unknown>)['#text']);
  return String(node).trim();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// shortcut: regex HTML strip, use a sanitizer if summaries are ever rendered as HTML
export function cleanText(s: string): string | null {
  const out = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (!e.startsWith('#')) return ENTITIES[e.toLowerCase()] ?? m;
      const code = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}

export function isoDate(pubDate: string, now: Date): string {
  const d = new Date(pubDate);
  return pubDate && !Number.isNaN(d.getTime()) ? d.toISOString() : now.toISOString();
}

const lower = (s: string) => s.toLocaleLowerCase('hu');

/** Only http(s) links may become event.url (it is rendered as a link and sent in alerts). */
export const httpUrl = (s: string): string | null => (/^https?:\/\//i.test(s) ? s : null);

export const rss: SourceAdapter<RssConfig> = {
  type: 'rss',
  configSchema: z.object({
    feedId: z.string().min(1),
    url: z.url({ protocol: /^https?$/ }),
    country: z.string().refine((c) => !!lookupCountry(c), 'unknown ISO2 country').nullable(),
    breakingKeywords: z.array(z.string()),
  }),
  url: (c) => c.url,
  normalize(body, config, now) {
    const breaking = config.breakingKeywords.map((k) => lower(k.trim())).filter(Boolean);
    return parseRssItems(body, `rss:${config.feedId}`).flatMap((item): NewEvent[] => {
      const title = cleanText(text(item.title)) ?? '';
      const rawLink = text(item.link);
      const externalId = text(item.guid) || rawLink || title;
      if (!externalId) return []; // no usable id: would collide on UNIQUE(source, external_id)
      const link = httpUrl(rawLink);
      const isBreaking = breaking.some((k) => lower(title).includes(k));
      return [{
        source: `rss:${config.feedId}`,
        externalId,
        category: 'news',
        title,
        summary: cleanText(text(item.description)),
        url: link,
        scope: config.country ? 'country' : 'global',
        country: config.country,
        // shortcut: RSS has no importance signal, upgrade to LLM scoring (non-goal v1)
        severity: isBreaking ? 0.8 : 0.5,
        occurredAt: isoDate(text(item.pubDate), now),
        raw: item,
      }];
    });
  },
};
