-- Fix FICA document storage policies to match current folder structure

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON storage.objects;

-- Create new policies that work with fica-documents/ folder structure
CREATE POLICY "Users can upload their own FICA documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
  );

CREATE POLICY "Users can view their own FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
  );

CREATE POLICY "Users can update their own FICA documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
  );

CREATE POLICY "Users can delete their own FICA documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
  );

-- Admins can view all FICA documents
CREATE POLICY "Admins can view all FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );
