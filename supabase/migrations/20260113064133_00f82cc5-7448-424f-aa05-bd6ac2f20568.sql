-- Create junction table for tenant-to-meter assignments (many-to-many)
CREATE TABLE public.project_tenant_meters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.project_tenants(id) ON DELETE CASCADE,
  scada_import_id UUID NOT NULL REFERENCES public.scada_imports(id) ON DELETE CASCADE,
  weight DECIMAL(5,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, scada_import_id)
);

-- Enable RLS
ALTER TABLE public.project_tenant_meters ENABLE ROW LEVEL SECURITY;

-- Create policies - allow all operations for now (linked to project_tenants which has proper ownership)
CREATE POLICY "Allow read access to tenant meters"
ON public.project_tenant_meters
FOR SELECT
USING (true);

CREATE POLICY "Allow insert for tenant meters"
ON public.project_tenant_meters
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for tenant meters"
ON public.project_tenant_meters
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete for tenant meters"
ON public.project_tenant_meters
FOR DELETE
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_tenant_meters_tenant_id ON public.project_tenant_meters(tenant_id);
CREATE INDEX idx_tenant_meters_scada_id ON public.project_tenant_meters(scada_import_id);

-- Comment for clarity
COMMENT ON TABLE public.project_tenant_meters IS 'Junction table allowing multiple meter assignments per tenant for averaged load profiles';
COMMENT ON COLUMN public.project_tenant_meters.weight IS 'Weight for averaging (1.0 = equal weight, higher = more influence)';