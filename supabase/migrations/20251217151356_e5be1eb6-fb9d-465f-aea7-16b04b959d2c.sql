
-- Create Businessrate tariff category
INSERT INTO public.tariff_categories (name, description)
VALUES ('Businessrate', 'Non-TOU tariff for small commercial users up to 100kVA')
ON CONFLICT DO NOTHING;

-- Get Eskom municipality ID and create Small Power Users municipality if needed
DO $$
DECLARE
  eskom_province_id UUID;
  small_power_municipality_id UUID;
  businessrate_category_id UUID;
BEGIN
  SELECT id INTO eskom_province_id FROM provinces WHERE name = 'Eskom';
  
  -- Create Small Power Users municipality if it doesn't exist
  INSERT INTO municipalities (name, province_id, extraction_status)
  VALUES ('Small Power Users', eskom_province_id, 'done')
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO small_power_municipality_id 
  FROM municipalities WHERE name = 'Small Power Users' AND province_id = eskom_province_id;
  
  SELECT id INTO businessrate_category_id FROM tariff_categories WHERE name = 'Businessrate';
  
  -- Insert Businessrate tariffs (LV only, different amperage tiers)
  INSERT INTO tariffs (name, municipality_id, category_id, tariff_type, voltage_level, phase_type, fixed_monthly_charge, demand_charge_per_kva, network_access_charge, has_seasonal_rates, customer_category, amperage_limit, capacity_kva)
  VALUES 
    -- Single Phase options
    ('Businessrate 1 (≤20A Single Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Single Phase', 131.70, 0, 0, false, 'Commercial', '20A', 4.6),
    ('Businessrate 1 (≤30A Single Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Single Phase', 131.70, 0, 0, false, 'Commercial', '30A', 6.9),
    ('Businessrate 1 (≤40A Single Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Single Phase', 131.70, 0, 0, false, 'Commercial', '40A', 9.2),
    ('Businessrate 1 (≤60A Single Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Single Phase', 197.55, 0, 0, false, 'Commercial', '60A', 13.8),
    ('Businessrate 1 (≤80A Single Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Single Phase', 263.40, 0, 0, false, 'Commercial', '80A', 18.4),
    -- Three Phase options
    ('Businessrate 2 (≤30A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 263.40, 0, 0, false, 'Commercial', '30A', 20.7),
    ('Businessrate 2 (≤40A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 329.25, 0, 0, false, 'Commercial', '40A', 27.6),
    ('Businessrate 2 (≤50A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 395.10, 0, 0, false, 'Commercial', '50A', 34.5),
    ('Businessrate 2 (≤60A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 460.95, 0, 0, false, 'Commercial', '60A', 41.4),
    ('Businessrate 2 (≤80A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 592.65, 0, 0, false, 'Commercial', '80A', 55.2),
    ('Businessrate 2 (≤100A Three Phase)', small_power_municipality_id, businessrate_category_id, 'Fixed', 'LV', 'Three Phase', 724.35, 0, 0, false, 'Commercial', '100A', 69.0);
END $$;

-- Insert flat rates for all Businessrate tariffs (no TOU, just tariff_rates)
WITH br_tariffs AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Businessrate%'
)
INSERT INTO tariff_rates (tariff_id, season, time_of_use, rate_per_kwh, block_start_kwh, block_end_kwh)
SELECT t.id, 'All Year'::season_type, 'Any'::time_of_use_type, 2.4567, 0, NULL
FROM br_tariffs t;
