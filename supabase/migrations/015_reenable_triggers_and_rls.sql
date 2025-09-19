-- Re-enable triggers and create proper RLS policies that work with signup

-- Re-enable the user profile creation trigger
CREATE TRIGGER create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_for_new_user();

-- Re-enable the shop creation trigger
CREATE TRIGGER create_shop_on_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_shop_for_new_user();

-- Re-enable RLS for user_profiles with proper policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that work with signup flow
-- Allow users to insert their own profile (needed for signup and triggers)
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- The public policy for viewing profiles of active shop owners already exists from migration 010
