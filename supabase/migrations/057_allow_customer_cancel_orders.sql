-- Fix the customer cancel orders policy
-- The issue: Without WITH CHECK, PostgreSQL uses USING to validate the NEW row too.
-- When status changes from 'pending' to 'cancelled', the new row fails the USING check.
-- Solution: Add WITH CHECK that only validates ownership, not status.

-- Drop the existing policy
DROP POLICY IF EXISTS "Customers can cancel their own pending orders" ON orders;

-- Recreate with WITH CHECK clause
-- USING: Selects which rows can be updated (must be pending, owned by user)
-- WITH CHECK: Validates the new row values (only need to verify ownership)
CREATE POLICY "Customers can cancel their own pending orders" ON orders
  FOR UPDATE 
  USING (
    customer_id = auth.uid() 
    AND status = 'pending' 
    AND payment_status = 'pending'
  )
  WITH CHECK (
    customer_id = auth.uid()
  );

