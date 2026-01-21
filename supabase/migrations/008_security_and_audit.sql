-- ============================================================
-- 008_security_and_audit.sql
-- Audit logs and rate limiting
-- ============================================================

-- ============================================================
-- AUDIT_LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  error_code TEXT,
  request_method TEXT,
  request_path TEXT,
  response_status INTEGER,
  duration_ms INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity) WHERE severity != 'info';
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON audit_logs(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_failed ON audit_logs(created_at DESC) WHERE success = false;
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN (details);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RATE_LIMITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  category TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limits_identifier_category_key UNIQUE (identifier, category)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_category ON rate_limits(category);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, category, window_end);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RATE_LIMIT_CONFIG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_rate_limit_config_updated_at
  BEFORE UPDATE ON rate_limit_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUDIT LOG FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_action TEXT,
  p_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL,
  p_response_status INTEGER DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    event_type, action, user_id, resource_type, resource_id, details,
    success, error_message, error_code, severity, ip_address, user_agent,
    request_method, request_path, response_status, duration_ms, session_id
  ) VALUES (
    p_event_type, p_action, p_user_id, p_resource_type, p_resource_id, p_details,
    p_success, p_error_message, p_error_code, p_severity, p_ip_address, p_user_agent,
    p_request_method, p_request_path, p_response_status, p_duration_ms, p_session_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE (
    (severity != 'critical' AND created_at < NOW() - (p_retention_days || ' days')::INTERVAL)
    OR
    (severity = 'critical' AND created_at < NOW() - INTERVAL '365 days')
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  PERFORM log_audit_event(
    'system.audit_cleanup', 'delete', NULL, 'audit_logs', NULL,
    jsonb_build_object('deleted_count', v_deleted_count, 'retention_days', p_retention_days), true
  );
  
  RETURN v_deleted_count;
END;
$$;

-- ============================================================
-- RATE LIMIT FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_category TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  current_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_existing_record RECORD;
BEGIN
  v_window_start := NOW();
  v_window_end := NOW() + (p_window_seconds || ' seconds')::INTERVAL;
  
  SELECT * INTO v_existing_record FROM rate_limits
  WHERE identifier = p_identifier AND category = p_category FOR UPDATE;
  
  IF v_existing_record IS NULL THEN
    INSERT INTO rate_limits (identifier, category, request_count, window_start, window_end, last_request_at)
    VALUES (p_identifier, p_category, 1, v_window_start, v_window_end, NOW())
    ON CONFLICT (identifier, category) DO UPDATE
    SET request_count = CASE
          WHEN rate_limits.window_end < NOW() THEN 1
          ELSE rate_limits.request_count + 1
        END,
        window_start = CASE WHEN rate_limits.window_end < NOW() THEN NOW() ELSE rate_limits.window_start END,
        window_end = CASE WHEN rate_limits.window_end < NOW() THEN NOW() + (p_window_seconds || ' seconds')::INTERVAL ELSE rate_limits.window_end END,
        last_request_at = NOW()
    RETURNING request_count INTO v_current_count;
    
    SELECT window_end INTO v_window_end FROM rate_limits
    WHERE identifier = p_identifier AND category = p_category;
    
  ELSIF v_existing_record.window_end < NOW() THEN
    UPDATE rate_limits SET request_count = 1, window_start = NOW(),
      window_end = NOW() + (p_window_seconds || ' seconds')::INTERVAL, last_request_at = NOW()
    WHERE identifier = p_identifier AND category = p_category;
    v_current_count := 1;
    v_window_end := NOW() + (p_window_seconds || ' seconds')::INTERVAL;
  ELSE
    UPDATE rate_limits SET request_count = request_count + 1, last_request_at = NOW()
    WHERE identifier = p_identifier AND category = p_category
    RETURNING request_count INTO v_current_count;
    v_window_end := v_existing_record.window_end;
  END IF;
  
  RETURN QUERY SELECT
    v_current_count <= p_max_requests AS allowed,
    GREATEST(0, p_max_requests - v_current_count) AS remaining,
    v_window_end AS reset_at,
    v_current_count AS current_count;
END;
$$;

CREATE OR REPLACE FUNCTION peek_rate_limit(p_identifier TEXT, p_category TEXT, p_max_requests INTEGER)
RETURNS TABLE (current_count INTEGER, remaining INTEGER, reset_at TIMESTAMPTZ, is_limited BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_record RECORD;
BEGIN
  SELECT * INTO v_record FROM rate_limits
  WHERE identifier = p_identifier AND category = p_category AND window_end > NOW();
  
  IF v_record IS NULL THEN
    RETURN QUERY SELECT 0, p_max_requests, NULL::TIMESTAMPTZ, false;
  ELSE
    RETURN QUERY SELECT v_record.request_count, GREATEST(0, p_max_requests - v_record.request_count),
      v_record.window_end, v_record.request_count >= p_max_requests;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION reset_rate_limit(p_identifier TEXT, p_category TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted_count INTEGER;
BEGIN
  IF p_category IS NULL THEN
    DELETE FROM rate_limits WHERE identifier = p_identifier;
  ELSE
    DELETE FROM rate_limits WHERE identifier = p_identifier AND category = p_category;
  END IF;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_rate_limit_config(p_category TEXT)
RETURNS TABLE (max_requests INTEGER, window_seconds INTEGER, is_enabled BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT rlc.max_requests, rlc.window_seconds, rlc.is_enabled
  FROM rate_limit_config rlc WHERE rlc.category = p_category;
END;
$$;

-- ============================================================
-- AUDIT LOGS VIEW
-- ============================================================

CREATE OR REPLACE VIEW audit_logs_summary AS
SELECT
  date_trunc('hour', created_at) AS hour,
  event_type,
  severity,
  COUNT(*) AS event_count,
  COUNT(*) FILTER (WHERE success = false) AS failure_count,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT ip_address) AS unique_ips
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

-- ============================================================
-- DEFAULT RATE LIMIT CONFIG
-- ============================================================

INSERT INTO rate_limit_config (category, max_requests, window_seconds, description) VALUES
  ('login', 5, 900, 'Login attempts: 5 per 15 minutes'),
  ('password_reset', 3, 3600, 'Password reset requests: 3 per hour'),
  ('signup', 3, 3600, 'Signup attempts: 3 per hour'),
  ('order_create', 10, 3600, 'Order creation: 10 per hour'),
  ('api_general', 100, 60, 'General API: 100 per minute'),
  ('message_send', 30, 60, 'Message sending: 30 per minute'),
  ('file_upload', 20, 300, 'File uploads: 20 per 5 minutes')
ON CONFLICT (category) DO NOTHING;

-- Comments
COMMENT ON TABLE audit_logs IS 'Centralized audit logging for security-relevant events';
COMMENT ON TABLE rate_limits IS 'Distributed rate limiting storage for sliding window algorithm';
COMMENT ON TABLE rate_limit_config IS 'Configuration for rate limit categories';
COMMENT ON FUNCTION log_audit_event IS 'Helper function to insert audit log entries';
COMMENT ON FUNCTION check_rate_limit IS 'Check and increment rate limit counter';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Retention policy function for audit logs';
