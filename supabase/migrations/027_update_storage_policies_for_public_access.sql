-- Update storage policies to allow public access to FICA documents

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own FICA documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON storage.objects;

-- Create new policies that allow public access to fica-documents
CREATE POLICY "Public can view FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND name LIKE 'fica-documents/%'
  );

-- Keep the other policies for upload/update/delete
-- (These should already exist from previous migrations)
