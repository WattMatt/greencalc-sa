
-- Create project_meter_connections table
CREATE TABLE public.project_meter_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_meter_id TEXT NOT NULL,
  child_meter_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_meter_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view project_meter_connections"
  ON public.project_meter_connections FOR SELECT
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can insert project_meter_connections"
  ON public.project_meter_connections FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update project_meter_connections"
  ON public.project_meter_connections FOR UPDATE
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete project_meter_connections"
  ON public.project_meter_connections FOR DELETE
  USING (auth.role() = 'authenticated'::text);

-- Create project_schematic_lines table
CREATE TABLE public.project_schematic_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schematic_id UUID NOT NULL REFERENCES public.project_schematics(id) ON DELETE CASCADE,
  from_x NUMERIC NOT NULL DEFAULT 0,
  from_y NUMERIC NOT NULL DEFAULT 0,
  to_x NUMERIC NOT NULL DEFAULT 0,
  to_y NUMERIC NOT NULL DEFAULT 0,
  line_type TEXT NOT NULL DEFAULT 'connection',
  color TEXT DEFAULT '#000000',
  stroke_width NUMERIC DEFAULT 2,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_schematic_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view project_schematic_lines"
  ON public.project_schematic_lines FOR SELECT
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can insert project_schematic_lines"
  ON public.project_schematic_lines FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update project_schematic_lines"
  ON public.project_schematic_lines FOR UPDATE
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete project_schematic_lines"
  ON public.project_schematic_lines FOR DELETE
  USING (auth.role() = 'authenticated'::text);
