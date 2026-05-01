-- Quizly D1 initial schema.
-- Scope: schema, constraints, indexes, and key relationships only.
-- RPC/service rewrites are tracked in #29, and app-layer authorization in #30.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  parent_pin_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guardian_id TEXT NOT NULL REFERENCES guardian_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  pin_hash TEXT,
  auth_mode TEXT NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('none', 'pin')),
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parent_reauth_challenges (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guardian_id TEXT NOT NULL REFERENCES guardian_accounts(id) ON DELETE CASCADE,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES genres(id) ON DELETE RESTRICT,
  icon_key TEXT NOT NULL,
  description TEXT,
  color_hint TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
  question_text TEXT NOT NULL,
  options TEXT NOT NULL CHECK (json_valid(options)),
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0),
  explanation TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  genre_id TEXT REFERENCES genres(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'normal',
  total_questions INTEGER NOT NULL CHECK (total_questions >= 0),
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0 AND correct_count <= total_questions),
  earned_points INTEGER NOT NULL DEFAULT 0 CHECK (earned_points >= 0),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS study_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  selected_index INTEGER NOT NULL CHECK (selected_index >= 0),
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS badge_definitions (
  key TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  level INTEGER,
  name TEXT NOT NULL,
  icon_path TEXT NOT NULL,
  is_secret INTEGER NOT NULL DEFAULT 0 CHECK (is_secret IN (0, 1)),
  condition_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(condition_json)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_badges (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES badge_definitions(key) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
  latest_progress INTEGER NOT NULL DEFAULT 0 CHECK (latest_progress >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (child_id, badge_key)
);

CREATE TABLE IF NOT EXISTS badge_unlock_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES badge_definitions(key) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_streak_state (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  current_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  longest_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
  last_studied_date TEXT,
  weekly_shield_count INTEGER NOT NULL DEFAULT 1 CHECK (weekly_shield_count >= 0),
  shield_week_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_daily_point_state (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  state_date TEXT NOT NULL,
  consecutive_correct_count INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_correct_count >= 0),
  streak_bonus_count INTEGER NOT NULL DEFAULT 0 CHECK (streak_bonus_count >= 0),
  daily_challenge_awarded INTEGER NOT NULL DEFAULT 0 CHECK (daily_challenge_awarded IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_learning_stats (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  perfect_session_count INTEGER NOT NULL DEFAULT 0 CHECK (perfect_session_count >= 0),
  genre_explorer_count INTEGER NOT NULL DEFAULT 0 CHECK (genre_explorer_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_genre_progress (
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  first_session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
  first_completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id, genre_id)
);

CREATE TABLE IF NOT EXISTS child_subject_stats (
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id, subject_id)
);

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

CREATE INDEX IF NOT EXISTS idx_child_profiles_guardian_id
  ON child_profiles(guardian_id);

CREATE INDEX IF NOT EXISTS idx_parent_reauth_challenges_guardian_expires
  ON parent_reauth_challenges(guardian_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_genres_parent_id
  ON genres(parent_id);

CREATE INDEX IF NOT EXISTS idx_questions_genre_active
  ON questions(genre_id, is_active);

CREATE INDEX IF NOT EXISTS idx_study_sessions_child_id
  ON study_sessions(child_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_child_genre
  ON study_sessions(child_id, genre_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_child_completed_desc
  ON study_sessions(child_id, COALESCE(completed_at, started_at) DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_study_history_child_id
  ON study_history(child_id);

CREATE INDEX IF NOT EXISTS idx_study_history_session_id
  ON study_history(session_id);

CREATE INDEX IF NOT EXISTS idx_point_transactions_child_id
  ON point_transactions(child_id);

CREATE INDEX IF NOT EXISTS idx_badge_definitions_family
  ON badge_definitions(family, sort_order);

CREATE INDEX IF NOT EXISTS idx_child_badges_child_id
  ON child_badges(child_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_badge_unlock_events_child_id
  ON badge_unlock_events(child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_completion_idempotency_expires
  ON study_completion_idempotency(expires_at);

CREATE INDEX IF NOT EXISTS idx_parent_pin_attempt_state_expires
  ON parent_pin_attempt_state(expires_at);

CREATE INDEX IF NOT EXISTS idx_parent_pin_cooldowns_expires
  ON parent_pin_cooldowns(expires_at);
