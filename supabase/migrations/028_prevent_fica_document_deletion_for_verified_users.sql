-- Prevent deletion of FICA documents for verified users

-- Create a function to check if user is FICA verified
CREATE OR REPLACE FUNCTION is_user_fica_verified(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND fica_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the RLS policy for deleting FICA documents to prevent deletion for verified users
DROP POLICY IF EXISTS "Users can delete their own FICA documents" ON fica_documents;

CREATE POLICY "Users can delete their own FICA documents" ON fica_documents
  FOR DELETE USING (
    auth.uid() = user_id 
    AND NOT is_user_fica_verified(auth.uid())
  );
