-- Add foreign key constraint with CASCADE delete from scada_imports to sites
-- First drop existing constraint if any (in case it exists without cascade)
ALTER TABLE public.scada_imports 
DROP CONSTRAINT IF EXISTS scada_imports_site_id_fkey;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE public.scada_imports 
ADD CONSTRAINT scada_imports_site_id_fkey 
FOREIGN KEY (site_id) 
REFERENCES public.sites(id) 
ON DELETE CASCADE;