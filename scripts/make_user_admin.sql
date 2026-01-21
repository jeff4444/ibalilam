-- ============================================================
-- make_user_admin.sql
-- Script to add a user to the admins table
-- SECURITY: This script should only be run by database administrators
-- ============================================================

-- Make user admin by user ID
-- Replace 'YOUR_USER_ID_HERE' with the actual user UUID
INSERT INTO admins (user_id, role, granted_by, notes)
VALUES (
  'YOUR_USER_ID_HERE',
  'admin',  -- Options: 'super_admin', 'admin', 'moderator'
  NULL,     -- Set to the admin user ID who is granting access, or NULL for initial setup
  'Initial admin setup'
)
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = true,
  updated_at = NOW();

-- Make user admin by email
-- Replace 'user@example.com' with the actual email
INSERT INTO admins (user_id, role, granted_by, notes)
SELECT 
  id,
  'admin',  -- Options: 'super_admin', 'admin', 'moderator'
  NULL,
  'Admin setup via email'
FROM auth.users 
WHERE email = 'user@example.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = true,
  updated_at = NOW();

-- ============================================================
-- HELPER QUERIES
-- ============================================================

-- List all admins
-- SELECT a.*, u.email 
-- FROM admins a
-- JOIN auth.users u ON a.user_id = u.id
-- ORDER BY a.created_at;

-- Deactivate an admin (soft delete - preserves audit trail)
-- UPDATE admins SET is_active = false, updated_at = NOW() WHERE user_id = 'USER_ID_HERE';

-- Reactivate an admin
-- UPDATE admins SET is_active = true, updated_at = NOW() WHERE user_id = 'USER_ID_HERE';

-- Change admin role
-- UPDATE admins SET role = 'super_admin', updated_at = NOW() WHERE user_id = 'USER_ID_HERE';

-- Hard delete an admin (use with caution - loses audit trail)
-- DELETE FROM admins WHERE user_id = 'USER_ID_HERE';
