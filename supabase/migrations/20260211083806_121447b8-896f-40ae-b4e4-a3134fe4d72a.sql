
CREATE TABLE public.generation_daily_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  actual_kwh numeric NULL,
  building_load_kwh numeric NULL,
  source text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_generation_daily_project_date ON public.generation_daily_records (project_id, date);

ALTER TABLE public.generation_daily_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily generation records"
ON public.generation_daily_records FOR SELECT
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can insert daily generation records"
ON public.generation_daily_records FOR INSERT
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update daily generation records"
ON public.generation_daily_records FOR UPDATE
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete daily generation records"
ON public.generation_daily_records FOR DELETE
USING (auth.role() = 'authenticated'::text);
