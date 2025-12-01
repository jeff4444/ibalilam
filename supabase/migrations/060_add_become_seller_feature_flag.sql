-- Add feature flag to control "Become a Seller" button visibility

-- Add a SELECT policy allowing all authenticated users to read feature flags
-- (Admins already have full access via existing policy)
CREATE POLICY "Authenticated users can read feature flags" ON feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert the enable_become_seller feature flag
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
  ('enable_become_seller', true, 'Allow users to become sellers from their profile page')
ON CONFLICT (flag_name) DO NOTHING;

