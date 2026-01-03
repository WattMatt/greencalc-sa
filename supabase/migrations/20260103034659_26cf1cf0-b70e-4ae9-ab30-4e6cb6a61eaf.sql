-- Create transmission zone enum
CREATE TYPE public.transmission_zone_type AS ENUM ('Zone 0-300km', 'Zone 300-600km', 'Zone 600-900km', 'Zone >900km');

-- Add new unbundled charge columns to tariffs table
ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS transmission_zone transmission_zone_type DEFAULT NULL,
ADD COLUMN IF NOT EXISTS generation_capacity_charge numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS legacy_charge_per_kwh numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS service_charge_per_day numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS administration_charge_per_day numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tariff_family text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_unbundled boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.tariffs.transmission_zone IS 'Distance from Johannesburg: Zone 0-300km, 300-600km, 600-900km, >900km';
COMMENT ON COLUMN public.tariffs.generation_capacity_charge IS 'GCC in R/kVA/month - new Eskom capacity charge phased in from FY2026';
COMMENT ON COLUMN public.tariffs.legacy_charge_per_kwh IS 'Legacy charge in c/kWh for government energy procurement programs';
COMMENT ON COLUMN public.tariffs.service_charge_per_day IS 'Daily service charge in R/day';
COMMENT ON COLUMN public.tariffs.administration_charge_per_day IS 'Daily administration charge in R/day';
COMMENT ON COLUMN public.tariffs.tariff_family IS 'Tariff family name: Megaflex, Miniflex, Homepower, Homeflex, etc.';
COMMENT ON COLUMN public.tariffs.is_unbundled IS 'Whether this tariff uses the new unbundled structure';

-- Add network and retail charge columns to tariff_rates for per-TOU unbundled rates
ALTER TABLE public.tariff_rates
ADD COLUMN IF NOT EXISTS network_charge_per_kwh numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ancillary_charge_per_kwh numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS energy_charge_per_kwh numeric DEFAULT NULL;

COMMENT ON COLUMN public.tariff_rates.network_charge_per_kwh IS 'Network component of unbundled rate in c/kWh';
COMMENT ON COLUMN public.tariff_rates.ancillary_charge_per_kwh IS 'Ancillary services component in c/kWh';
COMMENT ON COLUMN public.tariff_rates.energy_charge_per_kwh IS 'Pure energy component (excl legacy, network) in c/kWh';