-- Add scada_import_id column to link tenants to actual meter profiles
ALTER TABLE public.project_tenants 
ADD COLUMN scada_import_id UUID REFERENCES public.scada_imports(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_project_tenants_scada_import_id ON public.project_tenants(scada_import_id);