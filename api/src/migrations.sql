CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES agents(id),
  room_name  TEXT UNIQUE NOT NULL,
  title      TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at   TIMESTAMPTZ,
  ended_by   TEXT
);

CREATE TABLE IF NOT EXISTS participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('agent','customer')),
  identity     TEXT NOT NULL,
  display_name TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at      TIMESTAMPTZ,
  -- Reconnect grace window. When a participant drops, left_at is stamped and
  -- grace_until is set; if they rejoin before grace_until we re-open the row.
  -- A periodic sweep finalizes rows whose grace window has elapsed.
  grace_until  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
-- Only one open (not-yet-left) row per identity per session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_open
  ON participants(session_id, identity)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  identity   TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_identity TEXT NOT NULL,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('agent','customer')),
  sender_name     TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS recordings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  egress_id  TEXT,
  status     TEXT NOT NULL DEFAULT 'in_progress'
             CHECK (status IN ('in_progress','processing','ready','failed')),
  object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_egress ON recordings(egress_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_created ON sessions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_session_live ON participants(session_id) WHERE left_at IS NULL;

-- Chat file attachments (file sharing in call)
CREATE TABLE IF NOT EXISTS chat_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_identity TEXT NOT NULL,
  sender_name     TEXT,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  content_type    TEXT NOT NULL,
  object_key      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_files_session ON chat_files(session_id);

-- Add is_admin column to agents for admin dashboard access
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Short customer invite codes (e.g. /j/xk9m2pqa)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions(invite_code);
