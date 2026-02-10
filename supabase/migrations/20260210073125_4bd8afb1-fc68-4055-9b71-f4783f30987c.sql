
CREATE TABLE public.generation_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  actual_kwh NUMERIC,
  guaranteed_kwh NUMERIC,
  expected_kwh NUMERIC,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, month, year)
);

ALTER TABLE public.generation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view generation records"
  ON public.generation_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert generation records"
  ON public.generation_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update generation records"
  ON public.generation_records FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete generation records"
  ON public.generation_records FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_generation_records_updated_at
  BEFORE UPDATE ON public.generation_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
