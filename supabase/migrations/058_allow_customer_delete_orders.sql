-- Add DELETE policies for customers to delete their own pending orders

-- Policy for customers to delete their own pending orders
CREATE POLICY "Customers can delete their own pending orders" ON orders
  FOR DELETE 
  USING (
    customer_id = auth.uid() 
    AND status = 'pending' 
    AND payment_status = 'pending'
  );

-- Policy for customers to delete order items from their own pending orders
-- This is needed because we delete order items before deleting the order
CREATE POLICY "Customers can delete order items from their pending orders" ON order_items
  FOR DELETE 
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE customer_id = auth.uid() 
        AND status = 'pending' 
        AND payment_status = 'pending'
    )
  );

