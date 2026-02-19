ALTER TABLE public.tariff_plans
  ADD COLUMN effective_from DATE,
  ADD COLUMN effective_to DATE;