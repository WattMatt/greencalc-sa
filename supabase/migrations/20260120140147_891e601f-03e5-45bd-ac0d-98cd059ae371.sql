-- Create table for caching PVGIS solar radiation data per project
CREATE TABLE public.project_solar_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL CHECK (data_type IN ('tmy', 'monthly_radiation')),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  data_json JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, data_type)
);

-- Enable RLS
ALTER TABLE public.project_solar_data ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching projects table - anyone can access)
CREATE POLICY "Anyone can view project_solar_data"
ON public.project_solar_data FOR SELECT USING (true);

CREATE POLICY "Anyone can insert project_solar_data"
ON public.project_solar_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update project_solar_data"
ON public.project_solar_data FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete project_solar_data"
ON public.project_solar_data FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_solar_data_updated_at
BEFORE UPDATE ON public.project_solar_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();