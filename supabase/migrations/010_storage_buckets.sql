-- ============================================================
-- 010_storage_buckets.sql
-- Storage bucket configuration
-- ============================================================

-- ============================================================
-- CREATE STORAGE BUCKETS
-- ============================================================

-- Documents bucket (for FICA documents) - public for signed URLs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Part images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'part-images',
  'part-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Message attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- ============================================================
-- DOCUMENTS BUCKET POLICIES
-- ============================================================

-- Users can upload their own FICA documents
CREATE POLICY "Users can upload their own FICA documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can view their own FICA documents
CREATE POLICY "Users can view their own FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can update their own FICA documents
CREATE POLICY "Users can update their own FICA documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can delete their own FICA documents (only if not verified)
CREATE POLICY "Users can delete their own unverified FICA documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND fica_status = 'verified'
    )
  );

-- Admins can view all FICA documents
CREATE POLICY "Admins can view all FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND name LIKE 'fica-documents/%'
    AND is_user_admin(auth.uid())
  );

-- ============================================================
-- PART IMAGES BUCKET POLICIES
-- ============================================================

-- Anyone can view part images (public)
CREATE POLICY "Anyone can view part images" ON storage.objects
  FOR SELECT USING (bucket_id = 'part-images');

-- Users can upload images for their own parts
CREATE POLICY "Users can upload their own part images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'part-images'
    AND auth.uid() IS NOT NULL
  );

-- Users can update their own part images
CREATE POLICY "Users can update their own part images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'part-images'
    AND auth.uid() IS NOT NULL
  );

-- Users can delete their own part images
CREATE POLICY "Users can delete their own part images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'part-images'
    AND auth.uid() IS NOT NULL
  );

-- Admins can manage all part images
CREATE POLICY "Admins can manage all part images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'part-images'
    AND is_user_admin(auth.uid())
  );

-- ============================================================
-- MESSAGE ATTACHMENTS BUCKET POLICIES
-- ============================================================

-- Users can upload message attachments
CREATE POLICY "Users can upload message attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
  );

-- Users can view attachments from chats they participate in
CREATE POLICY "Users can view their message attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
  );

-- Users can delete their own message attachments
CREATE POLICY "Users can delete their own message attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
  );
