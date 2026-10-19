import type { z } from 'zod';
import type { AlertMessage } from './message';
import { emailAdapter } from './email';
import { slackAdapter } from './slack';

export type { AlertMessage } from './message';
export { buildMessage } from './message';

export interface ChannelAdapter<C> {
  type: string;
  configSchema: z.ZodType<C>;
  maskConfig(config: C): unknown;
  send(config: C, msg: AlertMessage): Promise<void>;
}

export function scrubSecrets(text: string, config: unknown): string {
  if (typeof config !== 'object' || config === null) return text;
  let out = text;
  for (const v of Object.values(config)) if (typeof v === 'string' && v.length > 8) out = out.split(v).join('***');
  return out;
}

export function createChannelRegistry(opts: { smtpUrl?: string; outboxDir: string; slackDryRun: boolean; fetchImpl?: typeof fetch; log: (msg: string) => void }): Record<'email' | 'slack', ChannelAdapter<any>> {
  return {
    email: emailAdapter({ smtpUrl: opts.smtpUrl, outboxDir: opts.outboxDir }),
    slack: slackAdapter({ dryRun: opts.slackDryRun, fetchImpl: opts.fetchImpl, log: opts.log }),
  };
}
