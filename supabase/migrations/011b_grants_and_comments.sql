-- ============================================================
-- 011b_grants_and_comments.sql
-- Additional grants and documentation comments
-- ============================================================

-- Keep safe functions accessible
GRANT EXECUTE ON FUNCTION get_or_create_wallet(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION validate_moq_quantity(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION get_tier_price(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION get_available_quantity(UUID) TO authenticated;

-- search_parts has default parameters, grant handled by GRANT ALL ON FUNCTIONS above

GRANT EXECUTE ON FUNCTION get_user_favorite_part_ids(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_part_save_count(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_part_chat_count(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_part_recent_views(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_chats_with_unread(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_shop_stats(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_shop_recent_orders(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION is_current_user_admin_or_service_role() TO authenticated;

GRANT EXECUTE ON FUNCTION get_admin_role(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION has_admin_role(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION can_publish_listings(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION is_loan_eligible(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION peek_rate_limit(TEXT, TEXT, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION get_rate_limit_config(TEXT) TO authenticated;

-- Security documentation comments
COMMENT ON FUNCTION record_wallet_deposit IS 'SECURITY: Only callable via service role. Records deposit from PayFast IPN webhook.';

COMMENT ON FUNCTION record_wallet_withdrawal IS 'SECURITY: Only callable via service role. Records withdrawal after admin approval.';

COMMENT ON FUNCTION add_to_wallet_escrow IS 'SECURITY: Only callable via service role. Adds sale funds to seller escrow.';

COMMENT ON FUNCTION release_wallet_escrow IS 'SECURITY: Only callable via service role. Releases escrow to available balance.';

COMMENT ON FUNCTION process_wallet_refund IS 'SECURITY: Only callable via service role. Processes refunds to buyer wallet.';

COMMENT ON FUNCTION atomic_escrow_hold IS 'SECURITY: Atomically adds funds to escrow. Uses FOR UPDATE locking. Only callable via service role.';

COMMENT ON FUNCTION atomic_escrow_release IS 'SECURITY: Atomically releases funds from escrow. Uses FOR UPDATE locking. Only callable via service role.';

COMMENT ON FUNCTION atomic_withdrawal_approve IS 'SECURITY: Atomically approves withdrawal. Uses FOR UPDATE locking. Only callable via service role.';

COMMENT ON FUNCTION get_or_create_wallet IS 'Safe for authenticated users - only creates empty wallet with zero balances.';

COMMENT ON FUNCTION admin_wallet_adjustment IS 'Has internal admin check - verifies caller is admin before allowing adjustment.';
