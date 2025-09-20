-- Fix FICA document storage policies properly with user ownership checks

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON storage.objects;

-- Create new policies that properly check user ownership
-- For uploads, we need to allow authenticated users to upload to fica-documents/ folder
CREATE POLICY "Users can upload their own FICA documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
    AND auth.uid() IS NOT NULL
  );

-- For viewing, we need to check if the user owns the document in the database
CREATE POLICY "Users can view their own FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
    AND (
      -- User can view if they own the document in fica_documents table
      EXISTS (
        SELECT 1 FROM fica_documents 
        WHERE file_url LIKE '%' || name || '%'
        AND user_id = auth.uid()
      )
      OR
      -- Admins can view all documents
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND user_role = 'admin'
      )
    )
  );

-- For updates, same logic as viewing
CREATE POLICY "Users can update their own FICA documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
    AND EXISTS (
      SELECT 1 FROM fica_documents 
      WHERE file_url LIKE '%' || name || '%'
      AND user_id = auth.uid()
    )
  );

-- For deletes, same logic as viewing
CREATE POLICY "Users can delete their own FICA documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
    AND EXISTS (
      SELECT 1 FROM fica_documents 
      WHERE file_url LIKE '%' || name || '%'
      AND user_id = auth.uid()
    )
  );
