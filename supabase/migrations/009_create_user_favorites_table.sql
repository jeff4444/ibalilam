-- Create user_favorites table to store user's liked/favorited parts
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only favorite a part once
  UNIQUE(user_id, part_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_part_id ON user_favorites(part_id);

-- Enable Row Level Security
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to get user's favorite part IDs
CREATE OR REPLACE FUNCTION get_user_favorite_part_ids(user_uuid UUID)
RETURNS TABLE(part_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT uf.part_id
  FROM user_favorites uf
  WHERE uf.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
