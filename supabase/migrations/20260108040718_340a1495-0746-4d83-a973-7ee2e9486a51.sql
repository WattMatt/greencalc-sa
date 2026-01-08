-- Add site_type column to sites table
ALTER TABLE public.sites ADD COLUMN site_type text;

-- Add index for filtering by type
CREATE INDEX idx_sites_type ON public.sites(site_type);