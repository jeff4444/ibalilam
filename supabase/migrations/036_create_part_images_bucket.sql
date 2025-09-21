-- Create storage bucket for part images

-- Create the part-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'part-images',
  'part-images',
  true, -- Public bucket so images can be viewed by anyone
  10485760, -- 10MB limit for images
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the part-images bucket
-- Users can upload images to their own folder
CREATE POLICY "Users can upload part images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'part-images' 
    AND auth.uid() IS NOT NULL
    AND name LIKE 'parts/' || auth.uid()::text || '/%'
  );

-- Anyone can view part images (public bucket)
CREATE POLICY "Anyone can view part images" ON storage.objects
  FOR SELECT USING (bucket_id = 'part-images');

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
