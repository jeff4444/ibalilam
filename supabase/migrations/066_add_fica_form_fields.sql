-- Add FICA form fields for verification

-- Add address field to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add business fields to shops table for FICA verification
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS owner_phone TEXT,
ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.address IS 'User physical address for FICA verification';
COMMENT ON COLUMN shops.registration_number IS 'Business registration number for FICA verification';
COMMENT ON COLUMN shops.owner_name IS 'Business owner full name for FICA verification';
COMMENT ON COLUMN shops.owner_phone IS 'Business owner phone number for FICA verification';
COMMENT ON COLUMN shops.owner_email IS 'Business owner email address for FICA verification';

