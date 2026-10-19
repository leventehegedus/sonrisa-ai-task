import { z } from 'zod';
import type { ChannelAdapter } from './index';

export interface SlackOpts { dryRun: boolean; fetchImpl?: typeof fetch; log: (msg: string) => void }
const configSchema = z.object({
  webhookUrl: z.url({ protocol: /^https$/ })
    .refine((u) => u.startsWith('https://hooks.slack.com/services/'), 'must be a Slack webhook URL')
    .refine((u) => !u.includes('…'), 'must not be the masked form'),
});

// Slack mrkdwn control chars: unescaped, feed text could inject <!channel> pings or disguised <url|label> links.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function slackAdapter(opts: SlackOpts): ChannelAdapter<{ webhookUrl: string }> {
  return {
    type: 'slack',
    configSchema,
    maskConfig: (config) => ({ ...config, webhookUrl: `https://hooks.slack.com/…/${config.webhookUrl.slice(-4)}` }),
    async send(config, msg) {
      const text = [`*${esc(msg.title)}*`, ...[msg.summary, msg.reason, msg.url].filter((v): v is string => !!v).map(esc)].join('\n');
      if (opts.dryRun) return opts.log(`[slack dry-run] ${text}`);
      let res: Response;
      try {
        res = await (opts.fetchImpl ?? fetch)(config.webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        throw new Error(`Slack request failed: ${err instanceof Error ? err.name : 'Error'}`);
      }
      if (!res.ok) throw new Error(`Slack responded ${res.status}`);
    },
  };
}
