-- 027: Grant get_or_create_wallet to authenticated
GRANT EXECUTE ON FUNCTION get_or_create_wallet(UUID) TO authenticated;
