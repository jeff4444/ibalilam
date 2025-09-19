-- Test triggers individually to identify which one is causing the issue

-- Disable all triggers first
DROP TRIGGER IF EXISTS create_shop_on_user_signup ON auth.users;
DROP TRIGGER IF EXISTS create_user_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS sync_user_metadata_with_shop_trigger ON auth.users;

-- Enable only the user profile creation trigger first
CREATE TRIGGER create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_for_new_user();
