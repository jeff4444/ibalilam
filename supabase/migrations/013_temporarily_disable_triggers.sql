-- Temporarily disable triggers to test if they're causing the signup issue
-- This will help us isolate whether the problem is with the triggers or something else

-- Disable the shop creation trigger
DROP TRIGGER IF EXISTS create_shop_on_user_signup ON auth.users;

-- Disable the user profile creation trigger  
DROP TRIGGER IF EXISTS create_user_profile_on_signup ON auth.users;

-- Disable the user metadata sync trigger
DROP TRIGGER IF EXISTS sync_user_metadata_with_shop_trigger ON auth.users;
