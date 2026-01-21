-- 022: atomic_withdrawal_reject function
CREATE OR REPLACE FUNCTION atomic_withdrawal_reject(
  p_transaction_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT DEFAULT 'Rejected by admin'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tx_status TEXT;
BEGIN
  IF p_transaction_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id and admin_id are required';
  END IF;
  SELECT status INTO v_tx_status FROM wallet_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_tx_status IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx_status != 'pending' THEN RETURN FALSE; END IF;
  UPDATE wallet_transactions SET status = 'failed',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'rejected_by', p_admin_id, 'rejected_at', NOW(), 'rejection_reason', p_rejection_reason),
    updated_at = NOW()
  WHERE id = p_transaction_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
