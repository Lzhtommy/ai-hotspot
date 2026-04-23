-- Phase 6 Plan 06-01: admin + ops schema extensions.
-- Idempotent — safe to re-run.
--
-- Adds:
--   sources.deleted_at  — ADMIN-05 soft-delete
--   sources.category    — ADMIN-03 source classification ('lab'|'social'|'forum'|'cn_media'|'other')
--   users.banned_at     — ADMIN-08 ban audit trail (when)
--   users.banned_by     — ADMIN-08 ban audit trail (who) — self-referencing FK
--   sources_deleted_at_idx — supports soft-delete-aware filtering
--
-- Hand-authored (Phase 3 + Plan 05-01 precedent): drizzle-kit push is non-TTY-hostile
-- and would propose to DROP the Plan 03-01 HNSW index (Drizzle DSL cannot represent
-- HNSW). Apply this file via scripts/apply-0005-admin-ops.ts.

ALTER TABLE sources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by UUID;

-- Self-referencing FK. ON DELETE SET NULL so deleting an admin user does not
-- cascade-wipe ban records for users they banned.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_banned_by_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_banned_by_fk
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Index for soft-delete-aware queries (sources list filtering).
CREATE INDEX IF NOT EXISTS sources_deleted_at_idx ON sources (deleted_at);
