-- Add detected_interval column to scada_imports table
-- This stores the detected data interval in minutes (e.g., 15, 30, 60)
ALTER TABLE public.scada_imports 
ADD COLUMN IF NOT EXISTS detected_interval_minutes integer DEFAULT NULL;