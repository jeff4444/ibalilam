-- Add missing fields to user_profiles table for admin functionality

-- Add suspension fields to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspension_until TIMESTAMP WITH TIME ZONE;

-- Add full_name field for easier display
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create function to update full_name when first_name or last_name changes
CREATE OR REPLACE FUNCTION update_user_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update full_name
CREATE TRIGGER trigger_update_user_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_full_name();

-- Update existing records to have full_name
UPDATE user_profiles 
SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE full_name IS NULL OR full_name = '';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_suspended ON user_profiles(is_suspended);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON user_profiles(full_name);

-- Update RLS policies to allow admins to view all user profiles
DROP POLICY IF EXISTS "Admins can view all user profiles" ON user_profiles;
CREATE POLICY "Admins can view all user profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all user profiles" ON user_profiles;
CREATE POLICY "Admins can update all user profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );
