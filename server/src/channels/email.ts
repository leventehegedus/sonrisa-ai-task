import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import type { ChannelAdapter } from './index';

export interface EmailOpts { smtpUrl?: string; outboxDir: string; log: (msg: string) => void }
export const sanitizeTo = (to: string) => to.replace(/[^A-Za-z0-9@._-]/g, '_');
const configSchema = z.object({ to: z.email() });

export function emailAdapter(opts: EmailOpts): ChannelAdapter<{ to: string }> {
  return {
    type: 'email',
    configSchema,
    maskConfig: (config) => config,
    async send(config, msg) {
      const transport = nodemailer.createTransport(opts.smtpUrl ?? { jsonTransport: true });
      const subject = `[World Alerts] ${msg.title}`;
      const info = await transport.sendMail({
        from: 'World Alerts <alerts@world-alerts.local>',
        to: config.to,
        subject,
        text: [msg.summary, msg.url, msg.reason].filter(Boolean).join('\n'),
      });
      if (!opts.smtpUrl) {
        fs.mkdirSync(opts.outboxDir, { recursive: true });
        const name = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeTo(config.to)}.json`;
        fs.writeFileSync(path.join(opts.outboxDir, name), String(info.message), { flag: 'wx' });
        opts.log(`email (outbox) to=${config.to} subject=${subject} file=${name}`);
      }
    },
  };
}
