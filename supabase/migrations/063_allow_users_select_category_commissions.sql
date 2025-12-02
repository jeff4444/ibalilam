-- Allow all authenticated users to select from category_commissions table
-- This is useful for displaying commission information to sellers

CREATE POLICY "All users can view category commissions" ON category_commissions
  FOR SELECT USING (true);

