
CREATE TABLE public.project_tariff_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_tariff_plan_id uuid NOT NULL,
  overridden_rates jsonb,
  overridden_plan_fields jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_tariff_plan_id)
);

ALTER TABLE public.project_tariff_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project_tariff_overrides"
ON public.project_tariff_overrides FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert project_tariff_overrides"
ON public.project_tariff_overrides FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update project_tariff_overrides"
ON public.project_tariff_overrides FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete project_tariff_overrides"
ON public.project_tariff_overrides FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER update_project_tariff_overrides_updated_at
BEFORE UPDATE ON public.project_tariff_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
