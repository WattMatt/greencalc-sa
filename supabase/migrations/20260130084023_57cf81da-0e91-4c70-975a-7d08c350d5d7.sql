-- Add shop_number and shop_name columns to project_tenants
ALTER TABLE project_tenants 
ADD COLUMN shop_number text,
ADD COLUMN shop_name text;

-- Migrate existing name data to shop_name
UPDATE project_tenants 
SET shop_name = name 
WHERE shop_name IS NULL;