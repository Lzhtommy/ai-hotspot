-- Phase 5 migration — adds Auth.js v5 adapter tables (accounts, sessions,
-- verification_tokens) and extends users with email_verified + image.
-- Hand-authored (Phase 3 precedent) because:
--   (a) @auth/drizzle-adapter expects camelCase SQL column names (e.g. "userId")
--       which drift from the project's snake_case convention.
--   (b) FK must be uuid -> uuid (RESEARCH §Pitfall 2); the docs' default text()
--       schema would fail against users.id uuid.
-- Source: 05-RESEARCH.md §Pattern 1 + §Pitfall 2; authjs.dev/getting-started/adapters/drizzle

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;

CREATE TABLE IF NOT EXISTS accounts (
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS accounts_userid_idx ON accounts ("userId");

CREATE TABLE IF NOT EXISTS sessions (
  "sessionToken" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_userid_idx ON sessions ("userId");

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
