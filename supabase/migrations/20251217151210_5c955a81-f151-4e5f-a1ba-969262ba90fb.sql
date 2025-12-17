
-- Get Eskom municipality ID and Nightsave category IDs
DO $$
DECLARE
  eskom_municipality_id UUID;
  nightsave_urban_id UUID;
  nightsave_rural_id UUID;
BEGIN
  SELECT m.id INTO eskom_municipality_id 
  FROM municipalities m 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND m.name = 'Large Power Users (TOU)';
  
  SELECT id INTO nightsave_urban_id FROM tariff_categories WHERE name = 'Nightsave Urban';
  SELECT id INTO nightsave_rural_id FROM tariff_categories WHERE name = 'Nightsave Rural';
  
  -- Insert Nightsave Urban MV/HV tariffs
  INSERT INTO tariffs (name, municipality_id, category_id, tariff_type, voltage_level, phase_type, fixed_monthly_charge, demand_charge_per_kva, network_access_charge, has_seasonal_rates, customer_category)
  VALUES 
    ('Nightsave Urban MV (<300km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 35.75, true, 'Commercial'),
    ('Nightsave Urban MV (300-600km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 51.91, true, 'Commercial'),
    ('Nightsave Urban MV (600-900km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 68.07, true, 'Commercial'),
    ('Nightsave Urban MV (>900km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 84.22, true, 'Commercial'),
    ('Nightsave Urban HV (<300km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 27.67, true, 'Commercial'),
    ('Nightsave Urban HV (300-600km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 43.83, true, 'Commercial'),
    ('Nightsave Urban HV (600-900km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 59.98, true, 'Commercial'),
    ('Nightsave Urban HV (>900km)', eskom_municipality_id, nightsave_urban_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 76.14, true, 'Commercial'),
    -- Nightsave Rural MV/HV tariffs
    ('Nightsave Rural MV (<300km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 35.75, true, 'Agriculture'),
    ('Nightsave Rural MV (300-600km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 51.91, true, 'Agriculture'),
    ('Nightsave Rural MV (600-900km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 68.07, true, 'Agriculture'),
    ('Nightsave Rural MV (>900km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'MV', 'Three Phase', 6584.85, 0, 84.22, true, 'Agriculture'),
    ('Nightsave Rural HV (<300km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 27.67, true, 'Agriculture'),
    ('Nightsave Rural HV (300-600km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 43.83, true, 'Agriculture'),
    ('Nightsave Rural HV (600-900km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 59.98, true, 'Agriculture'),
    ('Nightsave Rural HV (>900km)', eskom_municipality_id, nightsave_rural_id, 'TOU', 'HV', 'Three Phase', 6584.85, 0, 76.14, true, 'Agriculture');
END $$;

-- Insert TOU periods for Nightsave Urban MV (off-peak focused with peak/off-peak structure)
WITH urban_mv AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Nightsave Urban MV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM urban_mv t
CROSS JOIN (VALUES
  -- High Demand Season - Peak demand charge only, energy at off-peak rate
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 0.7775, 156.89),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 0.7775, 156.89),
  ('High/Winter', 'Weekday', 'Off-Peak', 0, 6, 0.7775, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 9, 17, 0.7775, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 19, 24, 0.7775, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 24, 0.7775, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7775, 0),
  -- Low Demand Season
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 0.6397, 59.89),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 0.6397, 59.89),
  ('Low/Summer', 'Weekday', 'Off-Peak', 0, 6, 0.6397, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 9, 17, 0.6397, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 19, 24, 0.6397, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 24, 0.6397, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6397, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);

-- Insert TOU periods for Nightsave Urban HV
WITH urban_hv AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Nightsave Urban HV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM urban_hv t
CROSS JOIN (VALUES
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 0.7341, 148.14),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 0.7341, 148.14),
  ('High/Winter', 'Weekday', 'Off-Peak', 0, 6, 0.7341, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 9, 17, 0.7341, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 19, 24, 0.7341, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 24, 0.7341, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7341, 0),
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 0.6039, 56.55),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 0.6039, 56.55),
  ('Low/Summer', 'Weekday', 'Off-Peak', 0, 6, 0.6039, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 9, 17, 0.6039, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 19, 24, 0.6039, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 24, 0.6039, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6039, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);

-- Insert TOU periods for Nightsave Rural MV
WITH rural_mv AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Nightsave Rural MV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM rural_mv t
CROSS JOIN (VALUES
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 0.8078, 163.02),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 0.8078, 163.02),
  ('High/Winter', 'Weekday', 'Off-Peak', 0, 6, 0.8078, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 9, 17, 0.8078, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 19, 24, 0.8078, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 24, 0.8078, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.8078, 0),
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 0.6645, 62.23),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 0.6645, 62.23),
  ('Low/Summer', 'Weekday', 'Off-Peak', 0, 6, 0.6645, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 9, 17, 0.6645, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 19, 24, 0.6645, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 24, 0.6645, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6645, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);

-- Insert TOU periods for Nightsave Rural HV
WITH rural_hv AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Nightsave Rural HV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM rural_hv t
CROSS JOIN (VALUES
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 0.7627, 153.90),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 0.7627, 153.90),
  ('High/Winter', 'Weekday', 'Off-Peak', 0, 6, 0.7627, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 9, 17, 0.7627, 0),
  ('High/Winter', 'Weekday', 'Off-Peak', 19, 24, 0.7627, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 24, 0.7627, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7627, 0),
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 0.6273, 58.75),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 0.6273, 58.75),
  ('Low/Summer', 'Weekday', 'Off-Peak', 0, 6, 0.6273, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 9, 17, 0.6273, 0),
  ('Low/Summer', 'Weekday', 'Off-Peak', 19, 24, 0.6273, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 24, 0.6273, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6273, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);
