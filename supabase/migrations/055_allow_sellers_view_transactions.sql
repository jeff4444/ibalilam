-- Allow sellers to view transactions for orders belonging to their shop

-- Create policy for sellers to view their own transactions
CREATE POLICY "Sellers can view transactions for their orders" ON transactions
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      WHERE o.shop_id IN (
        SELECT s.id FROM shops s WHERE s.user_id = auth.uid()
      )
    )
  );

