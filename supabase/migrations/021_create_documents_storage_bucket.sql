-- Create storage bucket for FICA documents

-- Create the documents bucket (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the documents bucket
DROP POLICY IF EXISTS "Users can upload their own FICA documents" ON storage.objects;
CREATE POLICY "Users can upload their own FICA documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own FICA documents" ON storage.objects;
CREATE POLICY "Users can view their own FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own FICA documents" ON storage.objects;
CREATE POLICY "Users can update their own FICA documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own FICA documents" ON storage.objects;
CREATE POLICY "Users can delete their own FICA documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can view all FICA documents
DROP POLICY IF EXISTS "Admins can view all FICA documents" ON storage.objects;
CREATE POLICY "Admins can view all FICA documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );
