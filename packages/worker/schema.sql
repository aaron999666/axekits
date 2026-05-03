PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free','basic','pro','enterprise')),
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('purchase','consumption','bonus','refund','workflow')),
  points_amount INTEGER NOT NULL,
  tool_id TEXT,
  workflow_id TEXT,
  stripe_session_id TEXT,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tools_stats (
  tool_id TEXT PRIMARY KEY,
  click_count INTEGER NOT NULL DEFAULT 0,
  workflow_use_count INTEGER NOT NULL DEFAULT 0,
  revenue_total INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK(health_status IN ('healthy','degraded','down','unknown')),
  last_checked_at INTEGER,
  last_clicked_at INTEGER
);

CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  description TEXT NOT NULL,
  description_zh TEXT NOT NULL,
  steps TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE free_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  used_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE r2_files (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  share_token TEXT UNIQUE,
  share_expires_at INTEGER,
  workflow_step INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 5,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (referrer_user_id) REFERENCES users(id),
  FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

CREATE INDEX idx_transactions_user_time ON transactions(user_id, created_at DESC);
CREATE INDEX idx_free_usage_user_date ON free_usage(user_id, used_at);
CREATE INDEX idx_r2_files_user ON r2_files(user_id, created_at DESC);
CREATE INDEX idx_r2_files_expires ON r2_files(share_expires_at) WHERE share_expires_at IS NOT NULL;
CREATE INDEX idx_tools_stats_clicks ON tools_stats(click_count DESC);
CREATE INDEX idx_workflows_use ON workflows(use_count DESC);

CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE admin_users (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('super_admin','ops_admin','finance_admin','viewer')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX idx_admin_audit_time ON admin_audit_logs(created_at DESC);
