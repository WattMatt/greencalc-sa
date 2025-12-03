-- Add voltage_level enum for NERSA compliance
CREATE TYPE voltage_level AS ENUM ('LV', 'MV', 'HV');

-- Add NERSA-compliant fields to tariffs table
ALTER TABLE public.tariffs 
ADD COLUMN IF NOT EXISTS reactive_energy_charge numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS voltage_level voltage_level DEFAULT 'LV',
ADD COLUMN IF NOT EXISTS capacity_kva numeric,
ADD COLUMN IF NOT EXISTS customer_category text;

-- Add reactive energy charge to tariff_rates for TOU tariffs
ALTER TABLE public.tariff_rates
ADD COLUMN IF NOT EXISTS reactive_energy_charge numeric;

-- Insert standard NERSA customer categories if they don't exist
INSERT INTO public.tariff_categories (name, description)
VALUES 
  ('Domestic', 'Residential/household electricity consumers'),
  ('Commercial', 'Business and commercial electricity consumers'),
  ('Industrial', 'Industrial and manufacturing electricity consumers'),
  ('Agriculture', 'Agricultural and farming electricity consumers'),
  ('Street Lighting', 'Public street and area lighting')
ON CONFLICT (name) DO NOTHING;