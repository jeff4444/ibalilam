-- Create function to automatically create a user profile for new users
CREATE OR REPLACE FUNCTION create_user_profile_for_new_user()
RETURNS TRIGGER AS $$
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

-- Create trigger to automatically create user profile when user signs up
CREATE TRIGGER create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_for_new_user();
