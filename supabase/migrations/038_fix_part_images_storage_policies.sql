-- Fix part images storage policies to match the correct file path structure

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload part images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own part images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own part images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all part images" ON storage.objects;

-- Create new policies with correct file path structure
-- Users can upload images to their own folder
CREATE POLICY "Users can upload part images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'part-images' 
    AND auth.uid() IS NOT NULL
    AND name LIKE 'parts/' || auth.uid()::text || '/%'
  );

-- Users can update their own part images
CREATE POLICY "Users can update their own part images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'part-images' 
    AND name LIKE 'parts/' || auth.uid()::text || '/%'
  );

-- Users can delete their own part images
CREATE POLICY "Users can delete their own part images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'part-images' 
    AND name LIKE 'parts/' || auth.uid()::text || '/%'
  );

-- Admins can manage all part images
CREATE POLICY "Admins can manage all part images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'part-images' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );
