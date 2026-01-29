-- Add plant_setup column to store walkways, cable trays, and other plant configuration
ALTER TABLE public.pv_layouts 
ADD COLUMN plant_setup jsonb DEFAULT NULL;