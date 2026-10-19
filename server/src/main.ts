import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChannelRegistry } from './channels';
import { openDb } from './db';
import { seed } from './db/seed';
import { buildApp } from './http/app';
import { startScheduler } from './pipeline/scheduler';

const port = Number(process.env.PORT ?? 3000);
const dataDir = fileURLToPath(new URL('../../data/', import.meta.url)); // repo-root data/, independent of cwd
const dbPath = process.env.DB_PATH ?? `${dataDir}alerts.db`;
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const now = () => new Date();

mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
seed(db, { slackWebhook: process.env.SEED_SLACK_WEBHOOK });

const registry = createChannelRegistry({
  smtpUrl: process.env.SMTP_URL,
  outboxDir: `${dataDir}outbox`,
  slackDryRun: (process.env.SLACK_DRY_RUN ?? '1') !== '0',
  log,
});
const app = buildApp(db, { registry, fetchImpl: fetch, now, log });

// shortcut: binds to localhost only because X-User-Id is not authentication; add real auth before exposing it
await app.listen({ port, host: '127.0.0.1' });
log(`World Alerts API on http://127.0.0.1:${port}`);
const scheduler = startScheduler(db, { registry, fetchImpl: fetch, now, log });

const shutdown = async () => {
  scheduler.stop();
  await app.close();
  db.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
