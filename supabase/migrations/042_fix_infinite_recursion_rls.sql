-- Fix infinite recursion in RLS policies for user_profiles

-- Drop the problematic admin policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all user profiles" ON user_profiles;

-- Create a function to check if user is admin without causing recursion
-- This function uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id AND user_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Create new admin policies using the function
CREATE POLICY "Admins can view all user profiles" ON user_profiles
  FOR SELECT USING (is_user_admin(auth.uid()));

CREATE POLICY "Admins can update all user profiles" ON user_profiles
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- Also create a policy for admins to insert profiles (for admin operations)
CREATE POLICY "Admins can insert user profiles" ON user_profiles
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));

-- Create a policy for admins to delete profiles (for admin operations)
CREATE POLICY "Admins can delete user profiles" ON user_profiles
  FOR DELETE USING (is_user_admin(auth.uid()));
