import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createChannelRegistry } from '../src/channels';
import { dispatchPending } from '../src/pipeline/dispatch';
import { pollSource } from '../src/pipeline/poll';
import { sourceAdapters } from '../src/sources';
import { addChannel, addRule, addUser, makeDb } from './helpers';

const telexXml = fs.readFileSync(new URL('./fixtures/telex.xml', import.meta.url), 'utf8');
// Fixture items are dated 2026-10-19 06:42Z..17:04Z; now sits just after them so the 24h guard keeps them all.
const now = () => new Date('2026-10-19T18:00:00Z');
const config = { feedId: 'telex', url: 'https://telex.hu/rss', country: 'HU', breakingKeywords: [] };
let dir: string | undefined;
afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); dir = undefined; });

describe('full chain: fixture → poll → ingest → dispatch → email outbox', () => {
  it('first poll is a baseline; only the item new in the second poll is delivered', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-chain-'));
    const outbox = path.join(dir, 'outbox');
    const db = makeDb();
    const user = addUser(db, { homeCountry: 'HU', email: 'anna@example.com' });
    addRule(db, user, { channelIds: [addChannel(db, user, { config: { to: 'anna@example.com' } })] });
    const sourceId = Number(db.prepare(`INSERT INTO sources (type, name, config, poll_interval_s) VALUES ('rss', 'Telex', ?, 300)`)
      .run(JSON.stringify(config)).lastInsertRowid);

    // Poll 1: the feed without its newest item.
    const older = telexXml.replace(/<item>[\s\S]*?<\/item>/, '');
    let body = older;
    const fetchImpl = (async () => new Response(body)) as unknown as typeof fetch;
    expect(await pollSource(db, sourceId, { fetchImpl, now })).toEqual({ ok: true, inserted: 49 });
    expect(db.prepare(`SELECT COUNT(*) FROM deliveries`).pluck().get()).toBe(0);

    // Poll 2: the full feed; one new item.
    body = telexXml;
    expect(await pollSource(db, sourceId, { fetchImpl, now })).toEqual({ ok: true, inserted: 1 });
    const newTitle = sourceAdapters.rss.normalize(telexXml, sourceAdapters.rss.configSchema.parse(config), now())[0]!.title;

    const registry = createChannelRegistry({ outboxDir: outbox, slackDryRun: true, log: () => {} });
    expect(await dispatchPending(db, registry, now())).toEqual({ sent: 1, failed: 0, retried: 0 });
    expect(db.prepare(`SELECT status FROM deliveries`).pluck().all()).toEqual(['sent']);
    const files = fs.readdirSync(outbox);
    expect(files).toHaveLength(1);
    const mail = JSON.parse(fs.readFileSync(path.join(outbox, files[0]!), 'utf8'));
    expect(mail.subject).toBe(`[World Alerts] ${newTitle}`);
  });
});
