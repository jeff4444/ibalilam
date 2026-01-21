-- ============================================================
-- 005_fica_system.sql
-- FICA verification documents, audit log, and admin system
-- ============================================================

-- ============================================================
-- ADMINS TABLE (SECURITY CRITICAL)
-- Separate table for admin users - cannot be modified by regular users
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT CHECK (role IN ('super_admin', 'admin', 'moderator')) DEFAULT 'admin',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- SECURITY: Only service_role can modify admins table
-- No regular user policies - admins table is managed only via service_role
-- This is intentional - admin management should only happen through secure backend routes

-- RLS Policies for admins table
-- Only service_role can insert/update/delete
-- Admins can read the table to verify other admins
CREATE POLICY "Service role can manage admins" ON admins
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Allow authenticated users to check if they are admin (read-only, own record only)
CREATE POLICY "Users can check their own admin status" ON admins
  FOR SELECT USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE admins IS 'SECURITY CRITICAL: Separate table for admin users. Only modifiable via service_role to prevent privilege escalation.';
COMMENT ON COLUMN admins.role IS 'Admin role level: super_admin (full access), admin (standard admin), moderator (limited admin)';
COMMENT ON COLUMN admins.granted_by IS 'User ID of the admin who granted this admin access';
COMMENT ON COLUMN admins.is_active IS 'Whether this admin account is currently active';

-- ============================================================
-- FICA_DOCUMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS fica_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT CHECK (document_type IN ('id_document', 'proof_of_address', 'id_selfie')) NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one document per type per user
  UNIQUE(user_id, document_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fica_documents_user_id ON fica_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fica_documents_type ON fica_documents(document_type);

-- Enable RLS
ALTER TABLE fica_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FICA_AUDIT_LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS fica_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT CHECK (action IN ('submitted', 'approved', 'rejected', 'resubmitted')) NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fica_audit_log_user_id ON fica_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fica_audit_log_performed_by ON fica_audit_log(performed_by);

-- Enable RLS
ALTER TABLE fica_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FICA HELPER FUNCTIONS
-- ============================================================

-- Function to log FICA actions
CREATE OR REPLACE FUNCTION log_fica_action(
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO fica_audit_log (user_id, action, performed_by, reason)
  VALUES (p_user_id, p_action, auth.uid(), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update FICA status
CREATE OR REPLACE FUNCTION update_fica_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Determine action based on status
  CASE p_status
    WHEN 'verified' THEN v_action := 'approved';
    WHEN 'rejected' THEN v_action := 'rejected';
    ELSE v_action := 'submitted';
  END CASE;
  
  -- Update user profile
  UPDATE user_profiles 
  SET 
    fica_status = p_status,
    fica_rejection_reason = CASE WHEN p_status = 'rejected' THEN p_reason ELSE NULL END,
    fica_verified_at = CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END,
    fica_reviewed_by = auth.uid(),
    fica_reviewed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log the action
  PERFORM log_fica_action(p_user_id, v_action, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can publish listings
CREATE OR REPLACE FUNCTION can_publish_listings(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND user_role = 'seller' 
    AND fica_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is eligible for loans
CREATE OR REPLACE FUNCTION is_loan_eligible(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND fica_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ADMIN PRIVILEGE PROTECTION
-- ============================================================

-- Security audit log table for blocked privilege escalation attempts
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT,
  old_value TEXT,
  attempted_value TEXT,
  blocked BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_blocked ON security_audit_log(blocked) WHERE blocked = true;

-- Enable RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Function to check if current user is admin or service role
CREATE OR REPLACE FUNCTION is_current_user_admin_or_service_role()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if running as service role (bypasses all checks)
  v_role := current_setting('role', true);
  IF v_role = 'service_role' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if current user exists in admins table and is active
  SELECT EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND is_active = true
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admins
    WHERE user_id = p_user_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get admin role for a user
CREATE OR REPLACE FUNCTION get_admin_role(p_user_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM admins
  WHERE user_id = p_user_id
    AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has specific admin role or higher
CREATE OR REPLACE FUNCTION has_admin_role(p_user_id UUID, p_required_role TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role
  FROM admins
  WHERE user_id = p_user_id
    AND is_active = true;
  
  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Role hierarchy: super_admin > admin > moderator
  CASE p_required_role
    WHEN 'moderator' THEN
      RETURN v_user_role IN ('super_admin', 'admin', 'moderator');
    WHEN 'admin' THEN
      RETURN v_user_role IN ('super_admin', 'admin');
    WHEN 'super_admin' THEN
      RETURN v_user_role = 'super_admin';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to protect sensitive columns in user_profiles
CREATE OR REPLACE FUNCTION protect_user_profile_sensitive_columns()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_blocked_column TEXT;
  v_old_value TEXT;
  v_new_value TEXT;
BEGIN
  -- Check if current user is admin or service role
  v_is_admin := is_current_user_admin_or_service_role();
  
  -- If admin or service role, allow all updates
  IF v_is_admin THEN
    RETURN NEW;
  END IF;
  
  -- NOTE: is_admin column has been removed from user_profiles
  -- Admin status is now managed in the separate 'admins' table
  -- which can only be modified via service_role
  
  -- Protect FICA status columns
  IF OLD.fica_status IS DISTINCT FROM NEW.fica_status THEN
    v_blocked_column := 'fica_status';
    v_old_value := OLD.fica_status::TEXT;
    v_new_value := NEW.fica_status::TEXT;
    
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, v_old_value, v_new_value, TRUE);
    
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column
      USING ERRCODE = '42501';
  END IF;
  
  IF OLD.fica_verified_at IS DISTINCT FROM NEW.fica_verified_at THEN
    v_blocked_column := 'fica_verified_at';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.fica_verified_at::TEXT, NEW.fica_verified_at::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  IF OLD.fica_reviewed_by IS DISTINCT FROM NEW.fica_reviewed_by THEN
    v_blocked_column := 'fica_reviewed_by';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.fica_reviewed_by::TEXT, NEW.fica_reviewed_by::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  IF OLD.fica_reviewed_at IS DISTINCT FROM NEW.fica_reviewed_at THEN
    v_blocked_column := 'fica_reviewed_at';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.fica_reviewed_at::TEXT, NEW.fica_reviewed_at::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  IF OLD.fica_rejection_reason IS DISTINCT FROM NEW.fica_rejection_reason THEN
    v_blocked_column := 'fica_rejection_reason';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.fica_rejection_reason::TEXT, NEW.fica_rejection_reason::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  -- Protect suspension columns
  IF OLD.is_suspended IS DISTINCT FROM NEW.is_suspended THEN
    v_blocked_column := 'is_suspended';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.is_suspended::TEXT, NEW.is_suspended::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  IF OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason THEN
    v_blocked_column := 'suspension_reason';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.suspension_reason::TEXT, NEW.suspension_reason::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  IF OLD.suspension_until IS DISTINCT FROM NEW.suspension_until THEN
    v_blocked_column := 'suspension_until';
    INSERT INTO security_audit_log (user_id, action, table_name, column_name, old_value, attempted_value, blocked)
    VALUES (auth.uid(), 'UPDATE_BLOCKED', 'user_profiles', v_blocked_column, OLD.suspension_until::TEXT, NEW.suspension_until::TEXT, TRUE);
    RAISE EXCEPTION 'Permission denied: Cannot modify % column', v_blocked_column USING ERRCODE = '42501';
  END IF;
  
  -- All checks passed, allow the update
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for protecting sensitive columns
CREATE TRIGGER protect_sensitive_columns_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_user_profile_sensitive_columns();

-- Comments
COMMENT ON TABLE security_audit_log IS 'Logs security-related events including blocked privilege escalation attempts';
COMMENT ON FUNCTION is_current_user_admin_or_service_role() IS 'Checks if current user is admin (via admins table) or using service role';
COMMENT ON FUNCTION is_user_admin(UUID) IS 'Checks if a specific user is an active admin via the admins table';
COMMENT ON FUNCTION get_admin_role(UUID) IS 'Returns the admin role for a user (super_admin, admin, moderator) or NULL if not admin';
COMMENT ON FUNCTION has_admin_role(UUID, TEXT) IS 'Checks if user has the specified admin role or higher in the hierarchy';
COMMENT ON FUNCTION protect_user_profile_sensitive_columns() IS 'Trigger function that prevents non-admin users from modifying sensitive columns in user_profiles';
COMMENT ON TRIGGER protect_sensitive_columns_trigger ON user_profiles IS 'Prevents privilege escalation by blocking modifications to sensitive columns';
