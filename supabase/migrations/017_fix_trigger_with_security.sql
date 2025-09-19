-- Fix the user profile trigger to work with RLS by using SECURITY DEFINER

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS create_user_profile_on_signup ON auth.users;
DROP FUNCTION IF EXISTS create_user_profile_for_new_user();

-- Create a new function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION create_user_profile_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create a user profile for the new user
  INSERT INTO user_profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_for_new_user();
