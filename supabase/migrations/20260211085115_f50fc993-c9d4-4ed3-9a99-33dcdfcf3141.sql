
CREATE TABLE public.generation_readings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  actual_kwh numeric NULL,
  building_load_kwh numeric NULL,
  source text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_generation_readings_project_ts
  ON public.generation_readings (project_id, timestamp);

ALTER TABLE public.generation_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view generation readings"
  ON public.generation_readings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert generation readings"
  ON public.generation_readings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update generation readings"
  ON public.generation_readings FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete generation readings"
  ON public.generation_readings FOR DELETE
  USING (auth.role() = 'authenticated');
