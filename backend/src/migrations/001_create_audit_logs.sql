-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- 添加注释
COMMENT ON TABLE audit_logs IS '审计日志表，记录所有关键操作';
COMMENT ON COLUMN audit_logs.action IS '操作类型：LOGIN, LOGOUT, CREATE, UPDATE, DELETE等';
COMMENT ON COLUMN audit_logs.resource_type IS '资源类型：USER, AGENT, CONFIG等';
COMMENT ON COLUMN audit_logs.status IS '操作状态：SUCCESS, FAILURE';
COMMENT ON COLUMN audit_logs.details IS 'JSON格式的详细信息';

