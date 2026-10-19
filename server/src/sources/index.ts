import type { z } from 'zod';
import type { NewEvent } from '../types';
import { gdacs } from './gdacs';
import { rss } from './rss';
import { coingecko } from './coingecko';

export interface SourceAdapter<C> {
  type: 'gdacs' | 'rss' | 'coingecko';
  configSchema: z.ZodType<C>;
  url(config: C): string;
  normalize(body: string, config: C, now: Date): NewEvent[]; // pure; throws on unparseable body
}

export const sourceAdapters: Record<SourceAdapter<any>['type'], SourceAdapter<any>> = { gdacs, rss, coingecko };
