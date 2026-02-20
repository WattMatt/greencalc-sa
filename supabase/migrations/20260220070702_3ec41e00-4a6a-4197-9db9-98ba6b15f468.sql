
-- Create project_schematics table
CREATE TABLE public.project_schematics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER NOT NULL DEFAULT 1,
  converted_image_path TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_schematic_meter_positions table
CREATE TABLE public.project_schematic_meter_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schematic_id UUID NOT NULL REFERENCES public.project_schematics(id) ON DELETE CASCADE,
  meter_id TEXT NOT NULL,
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  scale_x NUMERIC DEFAULT 1.0,
  scale_y NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_schematics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schematic_meter_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_schematics
CREATE POLICY "Authenticated users can view project_schematics"
  ON public.project_schematics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert project_schematics"
  ON public.project_schematics FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update project_schematics"
  ON public.project_schematics FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete project_schematics"
  ON public.project_schematics FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS policies for project_schematic_meter_positions
CREATE POLICY "Authenticated users can view meter_positions"
  ON public.project_schematic_meter_positions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert meter_positions"
  ON public.project_schematic_meter_positions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update meter_positions"
  ON public.project_schematic_meter_positions FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete meter_positions"
  ON public.project_schematic_meter_positions FOR DELETE
  USING (auth.role() = 'authenticated');

-- Updated_at triggers
CREATE TRIGGER update_project_schematics_updated_at
  BEFORE UPDATE ON public.project_schematics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_schematic_meter_positions_updated_at
  BEFORE UPDATE ON public.project_schematic_meter_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for schematics
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-schematics', 'project-schematics', true, 52428800);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload schematics"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-schematics' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view project schematics"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-schematics');

CREATE POLICY "Authenticated users can update schematics"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-schematics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete schematics"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-schematics' AND auth.role() = 'authenticated');

-- Enable realtime for project_schematics
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_schematics;
