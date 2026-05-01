-- Cloudflare-native state previously handled by Upstash Redis.

CREATE TABLE IF NOT EXISTS study_completion_idempotency (
  key TEXT PRIMARY KEY,
  guardian_id TEXT NOT NULL REFERENCES guardian_accounts(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  locked_until TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parent_pin_attempt_state (
  scope TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parent_pin_cooldowns (
  guardian_id TEXT PRIMARY KEY REFERENCES guardian_accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_study_completion_idempotency_expires
  ON study_completion_idempotency(expires_at);

CREATE INDEX IF NOT EXISTS idx_parent_pin_attempt_state_expires
  ON parent_pin_attempt_state(expires_at);

CREATE INDEX IF NOT EXISTS idx_parent_pin_cooldowns_expires
  ON parent_pin_cooldowns(expires_at);
