-- Add latitude and longitude columns to projects table
ALTER TABLE public.projects
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.latitude IS 'Site latitude for solar irradiance calculations';
COMMENT ON COLUMN public.projects.longitude IS 'Site longitude for solar irradiance calculations';