-- 030: Grant atomic_decrement_stock to service_role and authenticated
GRANT EXECUTE ON FUNCTION atomic_decrement_stock(UUID, INTEGER) TO service_role;
