-- Create Eskom as a special province
INSERT INTO public.provinces (name) VALUES ('Eskom')
ON CONFLICT (name) DO NOTHING;

-- Get the Eskom province ID and create tariff categories as "municipalities"
WITH eskom AS (
  SELECT id FROM public.provinces WHERE name = 'Eskom' LIMIT 1
)
INSERT INTO public.municipalities (name, province_id, extraction_status)
SELECT name, eskom.id, 'done'
FROM eskom, (VALUES 
  ('Large Power Users (TOU)'),
  ('Small Power Users'),
  ('Residential'),
  ('Rural'),
  ('Generator Tariffs')
) AS categories(name)
ON CONFLICT DO NOTHING;

-- Create tariff categories if they don't exist
INSERT INTO public.tariff_categories (name, description)
VALUES 
  ('Megaflex', 'TOU tariff for large power users with NMD from 1MVA'),
  ('Miniflex', 'TOU tariff for large power users with NMD from 25kVA to 5MVA'),
  ('Nightsave Urban', 'Off-peak tariff for urban large power users'),
  ('Nightsave Rural', 'Off-peak tariff for rural large power users'),
  ('MunicFlex', 'TOU tariff for local authority customers')
ON CONFLICT DO NOTHING;