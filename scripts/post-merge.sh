#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Create the express-session PostgreSQL store table if it doesn't exist
psql "$DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_user_sessions_expire ON user_sessions (expire);
"
