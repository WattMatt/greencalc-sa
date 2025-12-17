
-- Get Eskom municipality ID for Large Power Users
DO $$
DECLARE
  eskom_municipality_id UUID;
  megaflex_category_id UUID;
BEGIN
  -- Get the municipality ID
  SELECT m.id INTO eskom_municipality_id 
  FROM municipalities m 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND m.name = 'Large Power Users (TOU)';
  
  -- Get Megaflex category ID
  SELECT id INTO megaflex_category_id FROM tariff_categories WHERE name = 'Megaflex';
  
  -- Insert Megaflex MV tariff (≥500V & <66kV)
  INSERT INTO tariffs (name, municipality_id, category_id, tariff_type, voltage_level, phase_type, fixed_monthly_charge, demand_charge_per_kva, network_access_charge, has_seasonal_rates, customer_category)
  VALUES 
    ('Megaflex MV (<300km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'MV', 'Three Phase', 13169.70, 0, 35.75, true, 'Commercial'),
    ('Megaflex MV (300-600km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'MV', 'Three Phase', 13169.70, 0, 51.91, true, 'Commercial'),
    ('Megaflex MV (600-900km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'MV', 'Three Phase', 13169.70, 0, 68.07, true, 'Commercial'),
    ('Megaflex MV (>900km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'MV', 'Three Phase', 13169.70, 0, 84.22, true, 'Commercial'),
    ('Megaflex HV (<300km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'HV', 'Three Phase', 13169.70, 0, 27.67, true, 'Commercial'),
    ('Megaflex HV (300-600km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'HV', 'Three Phase', 13169.70, 0, 43.83, true, 'Commercial'),
    ('Megaflex HV (600-900km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'HV', 'Three Phase', 13169.70, 0, 59.98, true, 'Commercial'),
    ('Megaflex HV (>900km)', eskom_municipality_id, megaflex_category_id, 'TOU', 'HV', 'Three Phase', 13169.70, 0, 76.14, true, 'Commercial');
END $$;

-- Insert TOU periods for MV tariffs (using 2025/2026 rates from booklet)
WITH mv_tariffs AS (
  SELECT t.id, t.name 
  FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Megaflex MV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT 
  t.id,
  season::season_type,
  day_type::day_type,
  tou::time_of_use_type,
  start_hour,
  end_hour,
  rate,
  demand
FROM mv_tariffs t
CROSS JOIN (VALUES
  -- High Demand Season (June-August) - Weekday
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 4.5388, 71.42),
  ('High/Winter', 'Weekday', 'Standard', 9, 17, 1.5891, 33.74),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 4.5388, 71.42),
  ('High/Winter', 'Weekday', 'Standard', 19, 22, 1.5891, 33.74),
  ('High/Winter', 'Weekday', 'Off-Peak', 22, 6, 0.7775, 0),
  -- High Demand Season - Saturday
  ('High/Winter', 'Saturday', 'Standard', 7, 12, 1.5891, 33.74),
  ('High/Winter', 'Saturday', 'Standard', 18, 20, 1.5891, 33.74),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 7, 0.7775, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 12, 18, 0.7775, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 20, 24, 0.7775, 0),
  -- High Demand Season - Sunday
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7775, 0),
  -- Low Demand Season (Sept-May) - Weekday
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 1.4029, 27.25),
  ('Low/Summer', 'Weekday', 'Standard', 9, 17, 1.0900, 19.23),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 1.4029, 27.25),
  ('Low/Summer', 'Weekday', 'Standard', 19, 22, 1.0900, 19.23),
  ('Low/Summer', 'Weekday', 'Off-Peak', 22, 6, 0.6397, 0),
  -- Low Demand Season - Saturday
  ('Low/Summer', 'Saturday', 'Standard', 7, 12, 1.0900, 19.23),
  ('Low/Summer', 'Saturday', 'Standard', 18, 20, 1.0900, 19.23),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 7, 0.6397, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 12, 18, 0.6397, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 20, 24, 0.6397, 0),
  -- Low Demand Season - Sunday
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6397, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);

-- Insert TOU periods for HV tariffs (slightly lower rates than MV)
WITH hv_tariffs AS (
  SELECT t.id, t.name 
  FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Megaflex HV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT 
  t.id,
  season::season_type,
  day_type::day_type,
  tou::time_of_use_type,
  start_hour,
  end_hour,
  rate,
  demand
FROM hv_tariffs t
CROSS JOIN (VALUES
  -- High Demand Season (June-August) - Weekday
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 4.2851, 67.43),
  ('High/Winter', 'Weekday', 'Standard', 9, 17, 1.5004, 31.86),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 4.2851, 67.43),
  ('High/Winter', 'Weekday', 'Standard', 19, 22, 1.5004, 31.86),
  ('High/Winter', 'Weekday', 'Off-Peak', 22, 6, 0.7341, 0),
  -- High Demand Season - Saturday
  ('High/Winter', 'Saturday', 'Standard', 7, 12, 1.5004, 31.86),
  ('High/Winter', 'Saturday', 'Standard', 18, 20, 1.5004, 31.86),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 7, 0.7341, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 12, 18, 0.7341, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 20, 24, 0.7341, 0),
  -- High Demand Season - Sunday
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7341, 0),
  -- Low Demand Season (Sept-May) - Weekday
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 1.3245, 25.73),
  ('Low/Summer', 'Weekday', 'Standard', 9, 17, 1.0290, 18.16),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 1.3245, 25.73),
  ('Low/Summer', 'Weekday', 'Standard', 19, 22, 1.0290, 18.16),
  ('Low/Summer', 'Weekday', 'Off-Peak', 22, 6, 0.6039, 0),
  -- Low Demand Season - Saturday
  ('Low/Summer', 'Saturday', 'Standard', 7, 12, 1.0290, 18.16),
  ('Low/Summer', 'Saturday', 'Standard', 18, 20, 1.0290, 18.16),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 7, 0.6039, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 12, 18, 0.6039, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 20, 24, 0.6039, 0),
  -- Low Demand Season - Sunday
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6039, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);
