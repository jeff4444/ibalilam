-- ============================================================
-- 028_add_location_columns_to_parts.sql
-- Add location_city and location_town columns to parts table
-- ============================================================

-- Add location columns to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location_town TEXT;

-- Add index for location filtering
CREATE INDEX IF NOT EXISTS idx_parts_location_city ON parts(location_city);

-- Comments
COMMENT ON COLUMN parts.location_city IS 'Distribution center city/location for the part';
COMMENT ON COLUMN parts.location_town IS 'Specific town within the distribution center location';
