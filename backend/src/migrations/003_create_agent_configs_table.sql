-- UP
CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  api_key TEXT NOT NULL,
  app_id TEXT,
  model TEXT NOT NULL,
  max_tokens INTEGER,
  temperature REAL,
  system_prompt TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,
  rate_limit JSONB,
  features JSONB,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'db',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_provider ON agent_configs(provider);
CREATE INDEX IF NOT EXISTS idx_agent_configs_app ON agent_configs(app_id) WHERE app_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_configs_active ON agent_configs(is_active);

-- DOWN
DROP INDEX IF EXISTS idx_agent_configs_active;
DROP INDEX IF EXISTS idx_agent_configs_app;
DROP INDEX IF EXISTS idx_agent_configs_provider;
DROP TABLE IF EXISTS agent_configs;

