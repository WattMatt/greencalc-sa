-- Add latitude and longitude columns to sites table for geographic location support
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for spatial queries
CREATE INDEX IF NOT EXISTS idx_sites_coordinates ON public.sites (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.sites.latitude IS 'Geographic latitude coordinate for the site location';
COMMENT ON COLUMN public.sites.longitude IS 'Geographic longitude coordinate for the site location';