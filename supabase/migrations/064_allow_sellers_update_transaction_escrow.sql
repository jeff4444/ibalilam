-- Allow sellers to update escrow_status on transactions for orders belonging to their shop

-- Create policy for sellers to update escrow_status on their own transactions
CREATE POLICY "Sellers can update escrow_status for their orders" ON transactions
  FOR UPDATE USING (
    order_id IN (
      SELECT o.id FROM orders o
      WHERE o.shop_id IN (
        SELECT s.id FROM shops s WHERE s.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM orders o
      WHERE o.shop_id IN (
        SELECT s.id FROM shops s WHERE s.user_id = auth.uid()
      )
    )
  );

