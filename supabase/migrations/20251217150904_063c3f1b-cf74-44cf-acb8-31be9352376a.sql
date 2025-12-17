
-- Get Eskom municipality ID for Large Power Users and Miniflex category
DO $$
DECLARE
  eskom_municipality_id UUID;
  miniflex_category_id UUID;
BEGIN
  SELECT m.id INTO eskom_municipality_id 
  FROM municipalities m 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND m.name = 'Large Power Users (TOU)';
  
  SELECT id INTO miniflex_category_id FROM tariff_categories WHERE name = 'Miniflex';
  
  -- Insert Miniflex MV tariffs (≥500V & <66kV) - for 25kVA to 5MVA users
  INSERT INTO tariffs (name, municipality_id, category_id, tariff_type, voltage_level, phase_type, fixed_monthly_charge, demand_charge_per_kva, network_access_charge, has_seasonal_rates, customer_category, capacity_kva)
  VALUES 
    ('Miniflex MV (<300km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'MV', 'Three Phase', 1316.97, 0, 35.75, true, 'Commercial', 5000),
    ('Miniflex MV (300-600km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'MV', 'Three Phase', 1316.97, 0, 51.91, true, 'Commercial', 5000),
    ('Miniflex MV (600-900km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'MV', 'Three Phase', 1316.97, 0, 68.07, true, 'Commercial', 5000),
    ('Miniflex MV (>900km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'MV', 'Three Phase', 1316.97, 0, 84.22, true, 'Commercial', 5000),
    ('Miniflex HV (<300km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'HV', 'Three Phase', 1316.97, 0, 27.67, true, 'Commercial', 5000),
    ('Miniflex HV (300-600km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'HV', 'Three Phase', 1316.97, 0, 43.83, true, 'Commercial', 5000),
    ('Miniflex HV (600-900km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'HV', 'Three Phase', 1316.97, 0, 59.98, true, 'Commercial', 5000),
    ('Miniflex HV (>900km)', eskom_municipality_id, miniflex_category_id, 'TOU', 'HV', 'Three Phase', 1316.97, 0, 76.14, true, 'Commercial', 5000);
END $$;

-- Insert TOU periods for Miniflex MV tariffs
WITH mv_tariffs AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Miniflex MV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM mv_tariffs t
CROSS JOIN (VALUES
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 4.7157, 74.20),
  ('High/Winter', 'Weekday', 'Standard', 9, 17, 1.6510, 35.05),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 4.7157, 74.20),
  ('High/Winter', 'Weekday', 'Standard', 19, 22, 1.6510, 35.05),
  ('High/Winter', 'Weekday', 'Off-Peak', 22, 6, 0.8078, 0),
  ('High/Winter', 'Saturday', 'Standard', 7, 12, 1.6510, 35.05),
  ('High/Winter', 'Saturday', 'Standard', 18, 20, 1.6510, 35.05),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 7, 0.8078, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 12, 18, 0.8078, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 20, 24, 0.8078, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.8078, 0),
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 1.4578, 28.31),
  ('Low/Summer', 'Weekday', 'Standard', 9, 17, 1.1326, 19.98),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 1.4578, 28.31),
  ('Low/Summer', 'Weekday', 'Standard', 19, 22, 1.1326, 19.98),
  ('Low/Summer', 'Weekday', 'Off-Peak', 22, 6, 0.6645, 0),
  ('Low/Summer', 'Saturday', 'Standard', 7, 12, 1.1326, 19.98),
  ('Low/Summer', 'Saturday', 'Standard', 18, 20, 1.1326, 19.98),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 7, 0.6645, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 12, 18, 0.6645, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 20, 24, 0.6645, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6645, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);

-- Insert TOU periods for Miniflex HV tariffs
WITH hv_tariffs AS (
  SELECT t.id FROM tariffs t 
  JOIN municipalities m ON t.municipality_id = m.id 
  JOIN provinces p ON m.province_id = p.id 
  WHERE p.name = 'Eskom' AND t.name LIKE 'Miniflex HV%'
)
INSERT INTO tou_periods (tariff_id, season, day_type, time_of_use, start_hour, end_hour, rate_per_kwh, demand_charge_per_kva)
SELECT t.id, season::season_type, day_type::day_type, tou::time_of_use_type, start_hour, end_hour, rate, demand
FROM hv_tariffs t
CROSS JOIN (VALUES
  ('High/Winter', 'Weekday', 'Peak', 6, 9, 4.4524, 70.06),
  ('High/Winter', 'Weekday', 'Standard', 9, 17, 1.5588, 33.10),
  ('High/Winter', 'Weekday', 'Peak', 17, 19, 4.4524, 70.06),
  ('High/Winter', 'Weekday', 'Standard', 19, 22, 1.5588, 33.10),
  ('High/Winter', 'Weekday', 'Off-Peak', 22, 6, 0.7627, 0),
  ('High/Winter', 'Saturday', 'Standard', 7, 12, 1.5588, 33.10),
  ('High/Winter', 'Saturday', 'Standard', 18, 20, 1.5588, 33.10),
  ('High/Winter', 'Saturday', 'Off-Peak', 0, 7, 0.7627, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 12, 18, 0.7627, 0),
  ('High/Winter', 'Saturday', 'Off-Peak', 20, 24, 0.7627, 0),
  ('High/Winter', 'Sunday', 'Off-Peak', 0, 24, 0.7627, 0),
  ('Low/Summer', 'Weekday', 'Peak', 6, 9, 1.3762, 26.73),
  ('Low/Summer', 'Weekday', 'Standard', 9, 17, 1.0692, 18.87),
  ('Low/Summer', 'Weekday', 'Peak', 17, 19, 1.3762, 26.73),
  ('Low/Summer', 'Weekday', 'Standard', 19, 22, 1.0692, 18.87),
  ('Low/Summer', 'Weekday', 'Off-Peak', 22, 6, 0.6273, 0),
  ('Low/Summer', 'Saturday', 'Standard', 7, 12, 1.0692, 18.87),
  ('Low/Summer', 'Saturday', 'Standard', 18, 20, 1.0692, 18.87),
  ('Low/Summer', 'Saturday', 'Off-Peak', 0, 7, 0.6273, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 12, 18, 0.6273, 0),
  ('Low/Summer', 'Saturday', 'Off-Peak', 20, 24, 0.6273, 0),
  ('Low/Summer', 'Sunday', 'Off-Peak', 0, 24, 0.6273, 0)
) AS periods(season, day_type, tou, start_hour, end_hour, rate, demand);
