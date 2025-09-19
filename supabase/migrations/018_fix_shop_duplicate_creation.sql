-- Fix shop creation trigger to handle duplicate user_id constraint
-- The issue is that the trigger tries to INSERT without checking if a shop already exists

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS create_shop_on_user_signup ON auth.users;
DROP FUNCTION IF EXISTS create_shop_for_new_user();

-- Create a new function that handles duplicate user_id gracefully
CREATE OR REPLACE FUNCTION create_shop_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create a shop for the new user, but only if one doesn't already exist
  INSERT INTO shops (user_id, name, description, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'),
    COALESCE(NEW.raw_user_meta_data->>'shop_description', 'Welcome to my electronics shop!'),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER create_shop_on_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_shop_for_new_user();
