-- Add columns for project parameters that were previously stored in description JSON
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS budget numeric,
ADD COLUMN IF NOT EXISTS target_date date,
ADD COLUMN IF NOT EXISTS system_type text DEFAULT 'Solar';

-- Add a comment explaining the system_type options
COMMENT ON COLUMN public.projects.system_type IS 'Options: Solar, Solar + Battery, Hybrid';