-- Align FICA status update policy with admin helper to avoid RLS recursion

DROP POLICY IF EXISTS "Admins can update FICA status" ON user_profiles;

CREATE POLICY "Admins can update FICA status" ON user_profiles
  FOR UPDATE USING (is_user_admin(auth.uid()));

