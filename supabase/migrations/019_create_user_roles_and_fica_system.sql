-- Create user roles and FICA verification system

-- First, add user role and FICA status to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS user_role TEXT CHECK (user_role IN ('visitor', 'buyer', 'seller', 'admin', 'support')) DEFAULT 'visitor',
ADD COLUMN IF NOT EXISTS fica_status TEXT CHECK (fica_status IN ('pending', 'verified', 'rejected')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fica_rejection_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fica_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fica_reviewed_by UUID REFERENCES auth.users(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fica_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create FICA documents table
CREATE TABLE IF NOT EXISTS fica_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT CHECK (document_type IN ('id_document', 'proof_of_address', 'id_selfie')) NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one document per type per user
  UNIQUE(user_id, document_type)
);

-- Create FICA audit log table
CREATE TABLE IF NOT EXISTS fica_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT CHECK (action IN ('submitted', 'approved', 'rejected', 'resubmitted')) NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_role ON user_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_fica_status ON user_profiles(fica_status);
CREATE INDEX IF NOT EXISTS idx_fica_documents_user_id ON fica_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fica_documents_type ON fica_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_fica_audit_log_user_id ON fica_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fica_audit_log_performed_by ON fica_audit_log(performed_by);

-- Enable Row Level Security
ALTER TABLE fica_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fica_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for fica_documents
CREATE POLICY "Users can view their own FICA documents" ON fica_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own FICA documents" ON fica_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own FICA documents" ON fica_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own FICA documents" ON fica_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all FICA documents
CREATE POLICY "Admins can view all FICA documents" ON fica_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );

-- RLS policies for fica_audit_log
CREATE POLICY "Users can view their own FICA audit log" ON fica_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all FICA audit logs" ON fica_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can insert FICA audit logs" ON fica_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );

-- Update RLS policies for user_profiles to allow admins to view all profiles
CREATE POLICY "Admins can view all user profiles" ON user_profiles
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update FICA status" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_role = 'admin'
    )
  );

-- Create function to log FICA actions
CREATE OR REPLACE FUNCTION log_fica_action(
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO fica_audit_log (user_id, action, performed_by, reason)
  VALUES (p_user_id, p_action, auth.uid(), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update FICA status
CREATE OR REPLACE FUNCTION update_fica_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Determine action based on status
  CASE p_status
    WHEN 'verified' THEN v_action := 'approved';
    WHEN 'rejected' THEN v_action := 'rejected';
    ELSE v_action := 'submitted';
  END CASE;
  
  -- Update user profile
  UPDATE user_profiles 
  SET 
    fica_status = p_status,
    fica_rejection_reason = CASE WHEN p_status = 'rejected' THEN p_reason ELSE NULL END,
    fica_verified_at = CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END,
    fica_reviewed_by = auth.uid(),
    fica_reviewed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log the action
  PERFORM log_fica_action(p_user_id, v_action, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can publish listings
CREATE OR REPLACE FUNCTION can_publish_listings(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND user_role = 'seller' 
    AND fica_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is eligible for loans
CREATE OR REPLACE FUNCTION is_loan_eligible(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND fica_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
