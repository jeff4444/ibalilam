-- Add public access policies for marketplace functionality

-- Allow public to view active shops (for marketplace browsing)
CREATE POLICY "Public can view active shops" ON shops
  FOR SELECT USING (is_active = true);

-- Allow public to view user profiles for active shops
-- This enables seller contact functionality
CREATE POLICY "Public can view profiles of active shop owners" ON user_profiles
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM shops WHERE is_active = true
    )
  );
