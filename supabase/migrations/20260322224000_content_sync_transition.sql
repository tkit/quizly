-- no-op migration
-- purpose: keep migration version alignment after moving question content management
-- from SQL migrations to Storage-driven content sync.
BEGIN;
COMMIT;
