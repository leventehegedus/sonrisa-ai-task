import type { Database } from 'better-sqlite3';
import { sourceAdapters } from '../sources';

const USERS = [
  { name: 'Anna', email: 'anna@example.com', homeCountry: 'HU', isAdmin: true },
  { name: 'Bence', email: 'bence@example.com', homeCountry: 'HU', isAdmin: false },
  { name: 'Priya', email: 'priya@example.com', homeCountry: 'NP', isAdmin: false },
];

const SOURCES: { type: keyof typeof sourceAdapters; name: string; config: unknown }[] = [
  { type: 'gdacs', name: 'GDACS', config: {} },
  { type: 'coingecko', name: 'CoinGecko', config: { coins: ['bitcoin', 'ethereum'], minChangePct: 3 } },
  { type: 'rss', name: 'Telex', config: { feedId: 'telex', url: 'https://telex.hu/rss', country: 'HU', breakingKeywords: ['rendkívüli', 'breaking'] } },
  { type: 'rss', name: 'HVG', config: { feedId: 'hvg', url: 'https://hvg.hu/rss', country: 'HU', breakingKeywords: ['rendkívüli', 'breaking'] } },
  { type: 'rss', name: 'BBC World', config: { feedId: 'bbc-world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', country: null, breakingKeywords: ['breaking'] } },
];

/** Demo data. Runs only when `users` is empty, so it is safe to call on every start. */
export function seed(db: Database, opts: { slackWebhook?: string } = {}): void {
  db.transaction(() => {
    if ((db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n > 0) return;
    const insUser = db.prepare(`INSERT INTO users (name, email, home_country, is_admin) VALUES (?, ?, ?, ?)`);
    const insChannel = db.prepare(`INSERT INTO channels (user_id, type, config) VALUES (?, ?, ?)`);
    const insRule = db.prepare(`INSERT INTO rules (user_id, name, categories, keywords, threshold, channel_ids) VALUES (?, 'Default', '[]', '[]', 0.5, ?)`);
    const insSource = db.prepare(`INSERT INTO sources (type, name, config, poll_interval_s) VALUES (?, ?, ?, 300)`);

    for (const u of USERS) {
      const userId = insUser.run(u.name, u.email, u.homeCountry, u.isAdmin ? 1 : 0).lastInsertRowid;
      const channelIds = [Number(insChannel.run(userId, 'email', JSON.stringify({ to: u.email })).lastInsertRowid)];
      if (u.name === 'Bence' && opts.slackWebhook)
        channelIds.push(Number(insChannel.run(userId, 'slack', JSON.stringify({ webhookUrl: opts.slackWebhook })).lastInsertRowid));
      insRule.run(userId, JSON.stringify(channelIds));
    }
    for (const s of SOURCES) insSource.run(s.type, s.name, JSON.stringify(sourceAdapters[s.type].configSchema.parse(s.config)));
  })();
}
