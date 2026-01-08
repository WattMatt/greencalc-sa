-- Create sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  total_area_sqm NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view sites" ON public.sites FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sites" ON public.sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sites" ON public.sites FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sites" ON public.sites FOR DELETE USING (true);

-- Add site_id to scada_imports
ALTER TABLE public.scada_imports ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_scada_imports_site_id ON public.scada_imports(site_id);

-- Create trigger for updated_at
CREATE TRIGGER update_sites_updated_at
BEFORE UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();