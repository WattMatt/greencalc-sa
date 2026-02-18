
-- ============================================================================
-- NERSA TARIFF DATABASE MIGRATION
-- Drop old tariff-related tables and recreate with new NERSA schema
-- ============================================================================

-- 1. Drop foreign key from projects to tariffs
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_tariff_id_fkey;

-- 2. Drop views that may reference old tables
DROP VIEW IF EXISTS v_tariff_lookup CASCADE;
DROP VIEW IF EXISTS v_municipality_summary CASCADE;

-- 3. Drop old tariff-related tables (CASCADE handles FKs)
DROP TABLE IF EXISTS public.tou_periods CASCADE;
DROP TABLE IF EXISTS public.tariff_rates CASCADE;
DROP TABLE IF EXISTS public.tariffs CASCADE;
DROP TABLE IF EXISTS public.tariff_categories CASCADE;
DROP TABLE IF EXISTS public.extraction_runs CASCADE;
DROP TABLE IF EXISTS public.eskom_batch_status CASCADE;
DROP TABLE IF EXISTS public.municipalities CASCADE;
DROP TABLE IF EXISTS public.provinces CASCADE;

-- 4. Drop old conflicting enums
DROP TYPE IF EXISTS public.season_type CASCADE;
DROP TYPE IF EXISTS public.voltage_level CASCADE;
DROP TYPE IF EXISTS public.tariff_type CASCADE;
DROP TYPE IF EXISTS public.time_of_use_type CASCADE;
DROP TYPE IF EXISTS public.day_type CASCADE;
DROP TYPE IF EXISTS public.phase_type CASCADE;
DROP TYPE IF EXISTS public.transmission_zone_type CASCADE;

-- 5. Drop old function if exists
DROP FUNCTION IF EXISTS public.calculate_monthly_cost CASCADE;

-- ============================================================================
-- CREATE NEW ENUMS
-- ============================================================================

CREATE TYPE public.customer_category AS ENUM (
  'domestic', 'domestic_indigent', 'commercial', 'industrial', 'agricultural',
  'public_lighting', 'sports_facilities', 'public_benefit', 'bulk_reseller',
  'departmental', 'availability', 'other'
);

CREATE TYPE public.metering_type AS ENUM ('prepaid', 'conventional', 'both', 'unmetered');

CREATE TYPE public.tariff_structure AS ENUM (
  'flat', 'inclining_block', 'seasonal', 'time_of_use', 'demand', 'hybrid'
);

CREATE TYPE public.voltage_level AS ENUM ('low', 'medium', 'high');

CREATE TYPE public.charge_type AS ENUM (
  'basic', 'energy', 'demand', 'network_access', 'network_demand', 'reactive_energy',
  'service', 'admin', 'maintenance', 'availability', 'capacity', 'ancillary',
  'subsidy', 'surcharge', 'amperage', 'notified_demand'
);

CREATE TYPE public.season_type AS ENUM ('all', 'low', 'high');

CREATE TYPE public.tou_period AS ENUM ('all', 'peak', 'standard', 'off_peak');

-- ============================================================================
-- CREATE NEW TABLES
-- ============================================================================

-- PROVINCES (9 rows)
CREATE TABLE public.provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MUNICIPALITIES (177 rows)
CREATE TABLE public.municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nersa_increase_pct NUMERIC(5,2),
  financial_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(province_id, name)
);

CREATE INDEX idx_municipalities_province ON public.municipalities(province_id);
CREATE INDEX idx_municipalities_name ON public.municipalities(name);

-- TARIFF PLANS (~1,978 rows)
CREATE TABLE public.tariff_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scale_code TEXT,
  category public.customer_category NOT NULL,
  metering public.metering_type,
  structure public.tariff_structure NOT NULL,
  voltage public.voltage_level,
  phase TEXT,
  min_amps NUMERIC(10,2),
  max_amps NUMERIC(10,2),
  min_kva NUMERIC(10,2),
  max_kva NUMERIC(10,2),
  min_kw NUMERIC(10,2),
  max_kw NUMERIC(10,2),
  description TEXT,
  is_redundant BOOLEAN DEFAULT false,
  is_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tariff_plans_municipality ON public.tariff_plans(municipality_id);
CREATE INDEX idx_tariff_plans_category ON public.tariff_plans(category);
CREATE INDEX idx_tariff_plans_structure ON public.tariff_plans(structure);
CREATE INDEX idx_tariff_plans_metering ON public.tariff_plans(metering);

-- TARIFF RATES (~6,092 rows)
CREATE TABLE public.tariff_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_plan_id UUID NOT NULL REFERENCES public.tariff_plans(id) ON DELETE CASCADE,
  charge public.charge_type NOT NULL,
  season public.season_type NOT NULL DEFAULT 'all',
  tou public.tou_period NOT NULL DEFAULT 'all',
  block_number INT,
  block_min_kwh NUMERIC(10,2),
  block_max_kwh NUMERIC(10,2),
  consumption_threshold_kwh NUMERIC(10,2),
  is_above_threshold BOOLEAN,
  amount NUMERIC(12,4) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tariff_rates_plan ON public.tariff_rates(tariff_plan_id);
CREATE INDEX idx_tariff_rates_charge ON public.tariff_rates(charge);
CREATE INDEX idx_tariff_rates_season ON public.tariff_rates(season);
CREATE INDEX idx_tariff_rates_tou ON public.tariff_rates(tou);
CREATE INDEX idx_tariff_rates_block ON public.tariff_rates(block_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rates ENABLE ROW LEVEL SECURITY;

-- Public read access (NERSA tariff data is public information)
CREATE POLICY "Public read provinces" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "Public read municipalities" ON public.municipalities FOR SELECT USING (true);
CREATE POLICY "Public read tariff_plans" ON public.tariff_plans FOR SELECT USING (true);
CREATE POLICY "Public read tariff_rates" ON public.tariff_rates FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "Authenticated write provinces" ON public.provinces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated write municipalities" ON public.municipalities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated write tariff_plans" ON public.tariff_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated write tariff_rates" ON public.tariff_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW public.v_tariff_lookup AS
SELECT
  p.name AS province, p.code AS province_code,
  m.name AS municipality, m.nersa_increase_pct,
  tp.name AS tariff_name, tp.scale_code, tp.category, tp.metering,
  tp.structure, tp.voltage, tp.phase, tp.min_amps, tp.max_amps,
  tp.min_kva, tp.max_kva, tp.is_redundant, tp.is_recommended,
  tr.charge, tr.season, tr.tou, tr.block_number,
  tr.block_min_kwh, tr.block_max_kwh,
  tr.consumption_threshold_kwh, tr.is_above_threshold,
  tr.amount, tr.unit, tr.notes
FROM public.tariff_rates tr
JOIN public.tariff_plans tp ON tr.tariff_plan_id = tp.id
JOIN public.municipalities m ON tp.municipality_id = m.id
JOIN public.provinces p ON m.province_id = p.id;

CREATE VIEW public.v_municipality_summary AS
SELECT
  p.name AS province, m.name AS municipality, m.nersa_increase_pct,
  COUNT(DISTINCT tp.id) AS tariff_plan_count,
  COUNT(tr.id) AS total_rate_lines
FROM public.municipalities m
JOIN public.provinces p ON m.province_id = p.id
LEFT JOIN public.tariff_plans tp ON tp.municipality_id = m.id
LEFT JOIN public.tariff_rates tr ON tr.tariff_plan_id = tp.id
GROUP BY p.name, m.name, m.nersa_increase_pct
ORDER BY p.name, m.name;

-- ============================================================================
-- HELPER FUNCTION: Calculate monthly cost estimate
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_monthly_cost(
  p_municipality_id UUID,
  p_category public.customer_category,
  p_kwh_usage NUMERIC,
  p_season public.season_type DEFAULT 'all',
  p_demand_kva NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  tariff_name TEXT,
  basic_charge NUMERIC,
  energy_charge NUMERIC,
  demand_charge NUMERIC,
  total_estimate NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH plan_basics AS (
    SELECT tp.id AS plan_id, tp.name AS plan_name,
      COALESCE(SUM(CASE WHEN tr.charge = 'basic' THEN tr.amount END), 0) AS basic_total
    FROM tariff_plans tp
    JOIN tariff_rates tr ON tr.tariff_plan_id = tp.id
    WHERE tp.municipality_id = p_municipality_id
      AND tp.category = p_category
      AND tp.is_redundant = false
      AND (tr.season = 'all' OR tr.season = p_season)
    GROUP BY tp.id, tp.name
  ),
  plan_energy AS (
    SELECT tp.id AS plan_id,
      SUM(CASE
        WHEN tr.charge = 'energy' AND tr.block_number IS NOT NULL THEN
          tr.amount * GREATEST(0, LEAST(p_kwh_usage, COALESCE(tr.block_max_kwh, p_kwh_usage)) - COALESCE(tr.block_min_kwh, 0)) / 100.0
        WHEN tr.charge = 'energy' AND tr.block_number IS NULL THEN
          tr.amount * p_kwh_usage / 100.0
        ELSE 0
      END) AS energy_total
    FROM tariff_plans tp
    JOIN tariff_rates tr ON tr.tariff_plan_id = tp.id
    WHERE tp.municipality_id = p_municipality_id
      AND tp.category = p_category
      AND tp.is_redundant = false
      AND tr.charge = 'energy'
      AND (tr.season = 'all' OR tr.season = p_season)
      AND (tr.tou = 'all')
    GROUP BY tp.id
  ),
  plan_demand AS (
    SELECT tp.id AS plan_id,
      COALESCE(SUM(CASE WHEN tr.charge = 'demand' AND p_demand_kva IS NOT NULL
        THEN tr.amount * p_demand_kva END), 0) AS demand_total
    FROM tariff_plans tp
    JOIN tariff_rates tr ON tr.tariff_plan_id = tp.id
    WHERE tp.municipality_id = p_municipality_id
      AND tp.category = p_category
      AND tp.is_redundant = false
      AND (tr.season = 'all' OR tr.season = p_season)
    GROUP BY tp.id
  )
  SELECT pb.plan_name, pb.basic_total, COALESCE(pe.energy_total, 0),
    COALESCE(pd.demand_total, 0),
    pb.basic_total + COALESCE(pe.energy_total, 0) + COALESCE(pd.demand_total, 0)
  FROM plan_basics pb
  LEFT JOIN plan_energy pe ON pe.plan_id = pb.plan_id
  LEFT JOIN plan_demand pd ON pd.plan_id = pb.plan_id
  ORDER BY pb.plan_name;
END;
$$;

-- Also null out the tariff_id on projects since the old tariffs table is gone
UPDATE public.projects SET tariff_id = NULL;
