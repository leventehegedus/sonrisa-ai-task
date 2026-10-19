import { z } from 'zod';
import type { NewEvent } from '../types';
import type { SourceAdapter } from './index';

export interface CoingeckoConfig { coins: string[]; minChangePct: number }

const Body = z.record(z.string(), z.object({ usd: z.number(), usd_24h_change: z.number() }));

export const coingecko: SourceAdapter<CoingeckoConfig> = {
  type: 'coingecko',
  configSchema: z.object({
    coins: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).default(['bitcoin', 'ethereum']),
    minChangePct: z.number().positive().default(3),
  }) as z.ZodType<CoingeckoConfig>,
  url: (c) =>
    `https://api.coingecko.com/api/v3/simple/price?ids=${c.coins.join(',')}&vs_currencies=usd&include_24hr_change=true`,
  normalize(body, config, now) {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error('coingecko: body is not JSON');
    }
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new Error(`coingecko: unexpected body shape (${parsed.error.message})`);
    const day = now.toISOString().slice(0, 10);
    const events: NewEvent[] = [];
    for (const coin of config.coins) {
      const q = parsed.data[coin];
      if (!q || Math.abs(q.usd_24h_change) < config.minChangePct) continue;
      const pct = q.usd_24h_change;
      events.push({
        source: 'coingecko',
        externalId: `${coin}:${day}`,
        category: 'market',
        title: `${coin[0]!.toUpperCase()}${coin.slice(1)} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% in 24h`,
        summary: `Price: $${q.usd}`,
        url: `https://www.coingecko.com/en/coins/${coin}`,
        scope: 'global',
        country: null,
        severity: Math.min(1, Math.abs(pct) / 6),
        occurredAt: now.toISOString(),
        raw: { [coin]: q },
      });
    }
    return events;
  },
};
