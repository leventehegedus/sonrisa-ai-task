CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  home_country TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- valid = has an adapter in the channel registry; no CHECK so a new adapter needs no schema change
  config TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  threshold REAL NOT NULL DEFAULT 0.5,
  channel_ids TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('news', 'market', 'disaster')),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  country TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('country', 'global', 'unknown')),
  severity REAL NOT NULL,
  occurred_at TEXT NOT NULL,
  raw TEXT NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY,
  rule_id INTEGER REFERENCES rules(id) ON DELETE SET NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  score REAL NOT NULL,
  score_breakdown TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  next_attempt_at TEXT,
  UNIQUE (event_id, channel_id)
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  poll_interval_s INTEGER NOT NULL,
  last_polled_at TEXT,
  baseline_at TEXT,
  last_error TEXT
);
