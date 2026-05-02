PRAGMA foreign_keys = ON;

SELECT 'table_count' AS check_name, COUNT(*) AS value
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
  AND name NOT LIKE '_cf_%';

SELECT 'index_count' AS check_name, COUNT(*) AS value
FROM sqlite_master
WHERE type = 'index'
  AND name NOT LIKE 'sqlite_%';

SELECT 'foreign_key_violations' AS check_name, COUNT(*) AS value
FROM pragma_foreign_key_check;

WITH expected(name) AS (
  VALUES
    ('guardian_accounts'),
    ('child_profiles'),
    ('parent_reauth_challenges'),
    ('genres'),
    ('questions'),
    ('study_sessions'),
    ('study_history'),
    ('point_transactions'),
    ('badge_definitions'),
    ('child_badges'),
    ('badge_unlock_events'),
    ('child_streak_state'),
    ('child_daily_point_state'),
    ('child_learning_stats'),
    ('child_genre_progress'),
    ('child_subject_stats'),
    ('study_completion_idempotency'),
    ('parent_pin_attempt_state'),
    ('parent_pin_cooldowns'),
    ('users'),
    ('accounts'),
    ('sessions'),
    ('verification_tokens')
)
SELECT 'expected_tables_missing' AS check_name, COUNT(*) AS value
FROM (
  SELECT name
  FROM expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table'
      AND sqlite_master.name = expected.name
  )
);

SELECT 'json_check_constraints_smoke' AS check_name, COUNT(*) AS value
FROM pragma_table_info('questions')
WHERE name = 'options'
  AND type = 'TEXT';
