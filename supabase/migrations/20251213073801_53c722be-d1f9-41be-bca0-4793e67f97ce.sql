-- Create table for storing PV layouts per project
CREATE TABLE public.pv_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Layout',
  scale_pixels_per_meter NUMERIC,
  pv_config JSONB DEFAULT '{"panelWidth": 1.134, "panelHeight": 2.278, "orientation": "portrait", "tiltAngle": 10, "rowSpacing": 0.5, "panelWattage": 550}'::jsonb,
  roof_masks JSONB DEFAULT '[]'::jsonb,
  pv_arrays JSONB DEFAULT '[]'::jsonb,
  equipment JSONB DEFAULT '[]'::jsonb,
  cables JSONB DEFAULT '[]'::jsonb,
  pdf_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Enable RLS
ALTER TABLE public.pv_layouts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view pv_layouts" ON public.pv_layouts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pv_layouts" ON public.pv_layouts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pv_layouts" ON public.pv_layouts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pv_layouts" ON public.pv_layouts FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pv_layouts_updated_at
  BEFORE UPDATE ON public.pv_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();