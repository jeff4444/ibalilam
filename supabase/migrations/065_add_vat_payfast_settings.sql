-- Add VAT and Payfast fee settings

-- Insert VAT and Payfast fee percentages into global_settings
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) VALUES
  ('vat_percentage', '15', 'number', 'VAT percentage applied to listings'),
  ('payfast_fee_percentage', '2.3', 'number', 'Payfast transaction fee percentage')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert feature flags to enable/disable VAT and Payfast fees
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
  ('enable_vat_fees', false, 'Enable VAT fee calculation on listings'),
  ('enable_payfast_fees', true, 'Enable Payfast fee calculation on listings')
ON CONFLICT (flag_name) DO NOTHING;

-- Add RLS policy for authenticated users to read global_settings (for sell page)
-- Drop if exists and recreate to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read global settings" ON global_settings;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Authenticated users can read global settings" ON global_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

