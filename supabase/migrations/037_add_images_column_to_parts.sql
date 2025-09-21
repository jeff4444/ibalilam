-- Add images column to parts table to store multiple image URLs

-- Add images column as JSONB array to store multiple image URLs
ALTER TABLE parts ADD COLUMN IF NOT EXISTS images JSONB DEFAULT NULL;

-- Create index for images column for better query performance
CREATE INDEX IF NOT EXISTS idx_parts_images ON parts USING gin(images);

-- Update existing parts to move single image_url to images array
UPDATE parts 
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL 
AND images IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN parts.images IS 'Array of image URLs for the part, stored as JSONB';
