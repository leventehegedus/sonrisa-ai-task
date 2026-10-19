import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import type { ChannelAdapter } from './index';

export interface EmailOpts { smtpUrl?: string; outboxDir: string }
const configSchema = z.object({ to: z.email() });

export function emailAdapter(opts: EmailOpts): ChannelAdapter<{ to: string }> {
  return {
    type: 'email',
    configSchema,
    maskConfig: (config) => config,
    async send(config, msg) {
      const transport = nodemailer.createTransport(opts.smtpUrl ?? { jsonTransport: true });
      const info = await transport.sendMail({
        from: 'World Alerts <alerts@world-alerts.local>',
        to: config.to,
        subject: `[World Alerts] ${msg.title}`,
        text: [msg.summary, msg.url, msg.reason].filter(Boolean).join('\n'),
      });
      if (!opts.smtpUrl) {
        fs.mkdirSync(opts.outboxDir, { recursive: true });
        const safeTo = config.to.replace(/[^A-Za-z0-9@._-]/g, '_');
        fs.writeFileSync(path.join(opts.outboxDir, `${Date.now()}-${safeTo}.json`), String(info.message));
      }
    },
  };
}
