-- Make the documents bucket public so FICA documents can be viewed by admins

-- Update the documents bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documents';
