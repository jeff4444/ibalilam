-- Make user admin by user ID
UPDATE user_profiles
SET is_admin = true
WHERE user_id = 'YOUR_USER_ID_HERE';

-- Make user admin by email
UPDATE user_profiles
SET is_admin = true
WHERE user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'user@example.com'
);