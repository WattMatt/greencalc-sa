-- Add Critical Peak Pricing fields to tariffs table
ALTER TABLE public.tariffs 
ADD COLUMN IF NOT EXISTS critical_peak_rate numeric,
ADD COLUMN IF NOT EXISTS critical_peak_hours_per_month integer DEFAULT 0;

-- Add critical_peak to tou_periods time_of_use options
-- First, we need to update the enum to include Critical Peak
ALTER TYPE time_of_use_type ADD VALUE IF NOT EXISTS 'Critical Peak';

-- Add a comment explaining Critical Peak Pricing
COMMENT ON COLUMN public.tariffs.critical_peak_rate IS 'Critical Peak Pricing rate in c/kWh - applied during grid emergencies/load shedding';
COMMENT ON COLUMN public.tariffs.critical_peak_hours_per_month IS 'Expected hours per month when Critical Peak pricing applies';