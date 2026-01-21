-- ============================================================
-- 009_rls_policies.sql
-- All Row Level Security policies consolidated
-- ============================================================

-- ============================================================
-- SHOPS POLICIES
-- ============================================================

-- Users can view their own shop
CREATE POLICY "Users can view their own shop" ON shops
  FOR SELECT USING (auth.uid() = user_id);

-- Public can view active shops
CREATE POLICY "Public can view active shops" ON shops
  FOR SELECT USING (is_active = true);

-- Users can insert their own shop
CREATE POLICY "Users can insert their own shop" ON shops
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own shop
CREATE POLICY "Users can update their own shop" ON shops
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own shop
CREATE POLICY "Users can delete their own shop" ON shops
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- USER_PROFILES POLICIES
-- ============================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Public can view profiles of active shop owners
CREATE POLICY "Public can view profiles of active shop owners" ON user_profiles
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM shops WHERE is_active = true)
  );

-- Admins can view all user profiles
CREATE POLICY "Admins can view all user profiles" ON user_profiles
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile (admin status is managed in separate admins table)
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update FICA status
CREATE POLICY "Admins can update FICA status" ON user_profiles
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PARTS POLICIES
-- ============================================================

-- Users can view parts from their own shop
CREATE POLICY "Users can view parts from their own shop" ON parts
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Public can view active parts
CREATE POLICY "Public can view active parts" ON parts
  FOR SELECT USING (status = 'active');

-- Users can insert parts to their own shop
CREATE POLICY "Users can insert parts to their own shop" ON parts
  FOR INSERT WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Users can update parts in their own shop
CREATE POLICY "Users can update parts in their own shop" ON parts
  FOR UPDATE USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Users can delete parts from their own shop
CREATE POLICY "Users can delete parts from their own shop" ON parts
  FOR DELETE USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- ============================================================
-- PRICE_TIERS POLICIES
-- ============================================================

-- Public can view price tiers
CREATE POLICY "Public can view price tiers" ON price_tiers
  FOR SELECT USING (true);

-- Users can manage price tiers for their own parts
CREATE POLICY "Users can manage price tiers for their own parts" ON price_tiers
  FOR ALL USING (
    part_id IN (
      SELECT p.id FROM parts p
      JOIN shops s ON p.shop_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- ============================================================
-- ORDERS POLICIES
-- ============================================================

-- Users can view orders from their own shop
CREATE POLICY "Users can view orders from their own shop" ON orders
  FOR SELECT USING (
    shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- Users can view their own orders as customer
CREATE POLICY "Users can view their own orders as customer" ON orders
  FOR SELECT USING (customer_id = auth.uid() AND deleted_at IS NULL);

-- Admins can view all orders including deleted
CREATE POLICY "Admins can view all orders including deleted" ON orders
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Users can update orders from their own shop
CREATE POLICY "Users can update orders from their own shop" ON orders
  FOR UPDATE USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Customers can cancel their own pending orders
CREATE POLICY "Customers can cancel their own pending orders" ON orders
  FOR UPDATE 
  USING (customer_id = auth.uid() AND status = 'pending' AND payment_status = 'pending')
  WITH CHECK (customer_id = auth.uid());

-- Users can insert orders
CREATE POLICY "Users can insert orders" ON orders
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- ORDER_ITEMS POLICIES
-- ============================================================

-- Users can view order items from their shop orders
CREATE POLICY "Users can view order items from their shop orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
    )
  );

-- Users can view order items from their own orders
CREATE POLICY "Users can view order items from their own orders" ON order_items
  FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

-- Users can insert order items
CREATE POLICY "Users can insert order items" ON order_items
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- TRANSACTIONS POLICIES
-- ============================================================

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Sellers can view transactions for their orders
CREATE POLICY "Sellers can view their transactions" ON transactions
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
    )
  );

-- Admins can update transactions
CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- Sellers can update escrow status on their transactions
CREATE POLICY "Sellers can update escrow status" ON transactions
  FOR UPDATE USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
    )
  );

-- ============================================================
-- ESCROW_HOLDS POLICIES
-- ============================================================

-- Admins can view all escrow holds
CREATE POLICY "Admins can view all escrow holds" ON escrow_holds
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Admins can update escrow holds
CREATE POLICY "Admins can update escrow holds" ON escrow_holds
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- ============================================================
-- REVIEWS POLICIES
-- ============================================================

-- Users can view reviews for their own shop
CREATE POLICY "Users can view reviews for their own shop" ON reviews
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Users can view their own reviews
CREATE POLICY "Users can view their own reviews" ON reviews
  FOR SELECT USING (customer_id = auth.uid());

-- Public can view approved reviews
CREATE POLICY "Public can view approved reviews" ON reviews
  FOR SELECT USING (status = 'approved');

-- Users can insert their own reviews
CREATE POLICY "Users can insert their own reviews" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (customer_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE USING (customer_id = auth.uid());

-- ============================================================
-- SHOP_ANALYTICS POLICIES
-- ============================================================

-- Users can view analytics for their own shop
CREATE POLICY "Users can view analytics for their own shop" ON shop_analytics
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Users can insert analytics for their own shop
CREATE POLICY "Users can insert analytics for their own shop" ON shop_analytics
  FOR INSERT WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- Users can update analytics for their own shop
CREATE POLICY "Users can update analytics for their own shop" ON shop_analytics
  FOR UPDATE USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- ============================================================
-- USER INTERACTION POLICIES
-- ============================================================

-- user_favorites
CREATE POLICY "Users can view their own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- part_saves
CREATE POLICY "Users can view their own saves" ON part_saves
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own saves" ON part_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saves" ON part_saves
  FOR DELETE USING (auth.uid() = user_id);

-- part_chats
CREATE POLICY "Users can view chats they participate in" ON part_chats
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Users can create chats as buyers" ON part_chats
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can update chats they participate in" ON part_chats
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- part_chat_messages
CREATE POLICY "Users can view messages in their chats" ON part_chat_messages
  FOR SELECT USING (
    chat_id IN (SELECT id FROM part_chats WHERE buyer_id = auth.uid() OR seller_id = auth.uid())
  );
CREATE POLICY "Users can send messages in their chats" ON part_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    chat_id IN (SELECT id FROM part_chats WHERE buyer_id = auth.uid() OR seller_id = auth.uid())
  );

-- part_view_logs
CREATE POLICY "Users can view view logs for their own parts" ON part_view_logs
  FOR SELECT USING (
    part_id IN (SELECT p.id FROM parts p JOIN shops s ON p.shop_id = s.id WHERE s.user_id = auth.uid())
  );
CREATE POLICY "Anyone can insert view logs" ON part_view_logs
  FOR INSERT WITH CHECK (true);

-- message_read_status
CREATE POLICY "Users can view read status for their messages" ON message_read_status
  FOR SELECT USING (
    user_id = auth.uid() OR
    message_id IN (
      SELECT m.id FROM part_chat_messages m
      JOIN part_chats c ON m.chat_id = c.id
      WHERE c.buyer_id = auth.uid() OR c.seller_id = auth.uid()
    )
  );
CREATE POLICY "Users can mark messages as read" ON message_read_status
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- chat_notifications
CREATE POLICY "Users can view their own notifications" ON chat_notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON chat_notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON chat_notifications
  FOR INSERT WITH CHECK (true);

-- safety_tips_shown
CREATE POLICY "Users can view their own safety tips status" ON safety_tips_shown
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can mark safety tips as shown" ON safety_tips_shown
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- cart_items
CREATE POLICY "Users can view their own cart items" ON cart_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cart items" ON cart_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cart items" ON cart_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cart items" ON cart_items
  FOR DELETE USING (auth.uid() = user_id);

-- shipping_addresses
CREATE POLICY "Users can view their own shipping addresses" ON shipping_addresses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own shipping addresses" ON shipping_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shipping addresses" ON shipping_addresses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shipping addresses" ON shipping_addresses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- FICA POLICIES
-- ============================================================

-- fica_documents
CREATE POLICY "Users can view their own FICA documents" ON fica_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own FICA documents" ON fica_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own FICA documents" ON fica_documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own FICA documents" ON fica_documents
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all FICA documents" ON fica_documents
  FOR SELECT USING (is_user_admin(auth.uid()));

-- fica_audit_log
CREATE POLICY "Users can view their own FICA audit log" ON fica_audit_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all FICA audit logs" ON fica_audit_log
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can insert FICA audit logs" ON fica_audit_log
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));

-- security_audit_log
CREATE POLICY "Only admins can view security audit logs" ON security_audit_log
  FOR SELECT USING (
    is_user_admin(auth.uid()) OR current_setting('role', true) = 'service_role'
  );
CREATE POLICY "Only system can insert security audit logs" ON security_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- ADMIN SYSTEM POLICIES
-- ============================================================

-- category_commissions
CREATE POLICY "Admins can manage category commissions" ON category_commissions
  FOR ALL USING (is_user_admin(auth.uid()));
CREATE POLICY "Users can read category commissions" ON category_commissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- escrow_settings
CREATE POLICY "Admins can manage escrow settings" ON escrow_settings
  FOR ALL USING (is_user_admin(auth.uid()));

-- global_settings
CREATE POLICY "Admins can manage global settings" ON global_settings
  FOR ALL USING (is_user_admin(auth.uid()));
CREATE POLICY "Authenticated users can read global settings" ON global_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- feature_flags
CREATE POLICY "Anyone can read feature flags" ON feature_flags
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (is_user_admin(auth.uid()));

-- part_flags
CREATE POLICY "Users can view their own flags" ON part_flags
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create flags" ON part_flags
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all flags" ON part_flags
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can update flags" ON part_flags
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- admin_wallet_transactions
CREATE POLICY "Admins can view all wallet transactions" ON admin_wallet_transactions
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can insert wallet transactions" ON admin_wallet_transactions
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));
CREATE POLICY "Admins can update wallet transactions" ON admin_wallet_transactions
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- ============================================================
-- WALLET POLICIES
-- ============================================================

-- user_wallets (SECURITY: No UPDATE policy for users - prevents balance manipulation)
CREATE POLICY "Users can view their own wallet" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert wallets" ON user_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON user_wallets
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can update all wallets" ON user_wallets
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- wallet_transactions
CREATE POLICY "Users can view their own transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_wallets WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid())
  );
CREATE POLICY "System can insert transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_wallets WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can view all wallet transactions" ON wallet_transactions
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can insert wallet transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));

-- ============================================================
-- AUDIT AND RATE LIMIT POLICIES
-- ============================================================

-- audit_logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (
    user_id = auth.uid()
    AND event_type NOT LIKE 'admin.%'
    AND severity != 'critical'
  );
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- rate_limit_config
CREATE POLICY "Admins can view rate limit config" ON rate_limit_config
  FOR SELECT USING (is_user_admin(auth.uid()));
CREATE POLICY "Admins can modify rate limit config" ON rate_limit_config
  FOR ALL USING (is_user_admin(auth.uid()));

-- Comments
COMMENT ON POLICY "Users can view their own wallet" ON user_wallets IS 
  'SECURITY: Users can only READ their wallet data. All balance modifications must go through server-side API routes.';
COMMENT ON POLICY "System can insert wallets" ON user_wallets IS 
  'SECURITY: Users can create their own wallet. Balance fields default to 0.';
