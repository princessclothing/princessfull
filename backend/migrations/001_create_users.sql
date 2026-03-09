-- Migration 001: Create users table with role support
-- Roles: 'admin' | 'usuario'
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name         TEXT,
  role         TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index para lookup por email no login
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
