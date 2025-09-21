-- Fix existing data and apply new category constraints
-- This migration handles existing data that doesn't match the new category system

-- First, let's see what categories exist and map them to new ones
-- Update existing categories to match new schema
UPDATE parts SET category = CASE 
  WHEN category = 'microcontrollers' THEN 'steam_kits'
  WHEN category = 'sensors' THEN 'steam_kits'
  WHEN category = 'resistors' THEN 'steam_kits'
  WHEN category = 'capacitors' THEN 'steam_kits'
  WHEN category = 'transistors' THEN 'steam_kits'
  WHEN category = 'ics' THEN 'steam_kits'
  WHEN category = 'connectors' THEN 'steam_kits'
  WHEN category = 'displays' THEN 'other_electronics'
  WHEN category = 'power' THEN 'other_electronics'
  WHEN category = 'tools' THEN 'other_electronics'
  ELSE 'other_electronics' -- Default fallback for any other categories
END;

-- Now add the constraint
ALTER TABLE parts ADD CONSTRAINT parts_category_check 
  CHECK (category IN (
    'mobile_phones', 
    'phone_parts', 
    'phone_accessories', 
    'laptops', 
    'steam_kits', 
    'other_electronics'
  ));
