-- Add avatar URL support for messaging and profile displays

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_url ON user_profiles(avatar_url);

