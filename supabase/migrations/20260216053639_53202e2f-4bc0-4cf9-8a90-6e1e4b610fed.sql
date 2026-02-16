
CREATE TABLE public.downtime_slot_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  reading_source text NOT NULL,
  slot_override integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_day_source UNIQUE (project_id, year, month, day, reading_source)
);

ALTER TABLE public.downtime_slot_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view downtime_slot_overrides" ON public.downtime_slot_overrides FOR SELECT USING (true);
CREATE POLICY "Anyone can insert downtime_slot_overrides" ON public.downtime_slot_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update downtime_slot_overrides" ON public.downtime_slot_overrides FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete downtime_slot_overrides" ON public.downtime_slot_overrides FOR DELETE USING (true);
