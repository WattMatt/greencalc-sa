-- Add connection size to projects table
ALTER TABLE public.projects 
ADD COLUMN connection_size_kva numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.connection_size_kva IS 'Site electrical connection size in kVA. Solar PV systems are limited to 70% of this value.';