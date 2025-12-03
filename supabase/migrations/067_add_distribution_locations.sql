-- Add distribution locations column to shops table
-- This allows sellers to manage a list of distribution center locations (cities or addresses)
-- that can be selected when listing parts

ALTER TABLE shops ADD COLUMN IF NOT EXISTS distribution_locations TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN shops.distribution_locations IS 'Array of distribution center locations (cities or full addresses) where seller can ship from';

