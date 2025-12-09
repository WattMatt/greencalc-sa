-- Add area_sqm column to scada_imports for tracking shop floor area
ALTER TABLE public.scada_imports 
ADD COLUMN area_sqm numeric NULL;

-- Add a comment explaining the column purpose
COMMENT ON COLUMN public.scada_imports.area_sqm IS 'Floor area of the shop in square meters, used for kWh/sqm analysis';