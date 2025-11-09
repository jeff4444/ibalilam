-- Separate admin privileges from user roles

-- 1. Add is_admin flag and update existing data
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE user_profiles
SET is_admin = true
WHERE user_role = 'admin';

UPDATE user_profiles
SET user_role = 'buyer'
WHERE user_role IN ('admin', 'support');

-- 2. Tighten user_role constraint to visitor/buyer/seller only
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_user_role_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_user_role_check
CHECK (user_role IN ('visitor', 'buyer', 'seller'));

-- 3. Index the admin flag for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin);

-- 4. Update helper function for admin checks
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = p_user_id
      AND is_admin IS TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Refresh policies to rely on is_admin flag

-- user_profiles
DROP POLICY IF EXISTS "Admins can update FICA status" ON user_profiles;
CREATE POLICY "Admins can update FICA status" ON user_profiles
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- fica_documents
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON fica_documents;
CREATE POLICY "Admins can view all FICA documents" ON fica_documents
  FOR SELECT USING (is_user_admin(auth.uid()));

-- fica_audit_log
DROP POLICY IF EXISTS "Admins can view all FICA audit logs" ON fica_audit_log;
CREATE POLICY "Admins can view all FICA audit logs" ON fica_audit_log
  FOR SELECT USING (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert FICA audit logs" ON fica_audit_log;
CREATE POLICY "Admins can insert FICA audit logs" ON fica_audit_log
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));

-- storage.objects (FICA documents)
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON storage.objects;
CREATE POLICY "Admins can view all FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND is_user_admin(auth.uid())
  );

-- storage.objects (part images)
DROP POLICY IF EXISTS "Admins can manage all part images" ON storage.objects;
CREATE POLICY "Admins can manage all part images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'part-images'
    AND is_user_admin(auth.uid())
  );

-- transactions
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;
CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- escrow_holds
DROP POLICY IF EXISTS "Admins can view all escrow holds" ON escrow_holds;
CREATE POLICY "Admins can view all escrow holds" ON escrow_holds
  FOR SELECT USING (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update escrow holds" ON escrow_holds;
CREATE POLICY "Admins can update escrow holds" ON escrow_holds
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- part_flags
DROP POLICY IF EXISTS "Admins can view all flags" ON part_flags;
CREATE POLICY "Admins can view all flags" ON part_flags
  FOR SELECT USING (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update flags" ON part_flags;
CREATE POLICY "Admins can update flags" ON part_flags
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- category_commissions
DROP POLICY IF EXISTS "Admins can manage category commissions" ON category_commissions;
CREATE POLICY "Admins can manage category commissions" ON category_commissions
  FOR ALL USING (is_user_admin(auth.uid()));

-- escrow_settings
DROP POLICY IF EXISTS "Admins can manage escrow settings" ON escrow_settings;
CREATE POLICY "Admins can manage escrow settings" ON escrow_settings
  FOR ALL USING (is_user_admin(auth.uid()));

-- global_settings
DROP POLICY IF EXISTS "Admins can manage global settings" ON global_settings;
CREATE POLICY "Admins can manage global settings" ON global_settings
  FOR ALL USING (is_user_admin(auth.uid()));

-- feature_flags
DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;
CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (is_user_admin(auth.uid()));

