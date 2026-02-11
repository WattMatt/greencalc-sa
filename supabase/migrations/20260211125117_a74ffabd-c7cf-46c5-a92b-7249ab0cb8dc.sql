
-- Table to store per-source guarantee values for generation
CREATE TABLE public.generation_source_guarantees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  source_label TEXT NOT NULL,
  guaranteed_kwh NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, month, year, source_label)
);

ALTER TABLE public.generation_source_guarantees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view generation_source_guarantees"
ON public.generation_source_guarantees FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert generation_source_guarantees"
ON public.generation_source_guarantees FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update generation_source_guarantees"
ON public.generation_source_guarantees FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete generation_source_guarantees"
ON public.generation_source_guarantees FOR DELETE
USING (auth.role() = 'authenticated');

CREATE TRIGGER update_generation_source_guarantees_updated_at
BEFORE UPDATE ON public.generation_source_guarantees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
