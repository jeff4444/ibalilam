-- Allow customers to cancel their own pending orders
-- This policy only allows updating orders where the customer owns the order
-- and the order is in a pending status with pending payment

CREATE POLICY "Customers can cancel their own pending orders" ON orders
  FOR UPDATE USING (
    customer_id = auth.uid() 
    AND status = 'pending' 
    AND payment_status = 'pending'
  );

