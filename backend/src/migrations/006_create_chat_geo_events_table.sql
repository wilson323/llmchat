-- UP
CREATE TABLE IF NOT EXISTS chat_geo_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  session_id TEXT,
  ip TEXT,
  country TEXT,
  province TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_geo_events_created ON chat_geo_events(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_geo_events_agent ON chat_geo_events(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_geo_events_country ON chat_geo_events(country);

-- DOWN
DROP INDEX IF EXISTS idx_chat_geo_events_country;
DROP INDEX IF EXISTS idx_chat_geo_events_agent;
DROP INDEX IF EXISTS idx_chat_geo_events_created;
DROP TABLE IF EXISTS chat_geo_events;

