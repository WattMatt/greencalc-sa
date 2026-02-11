
-- Drop the existing unique index on (project_id, timestamp)
DROP INDEX IF EXISTS idx_generation_readings_project_ts;

-- Create new unique index on (project_id, timestamp, source)
CREATE UNIQUE INDEX idx_generation_readings_project_ts_source 
ON public.generation_readings (project_id, timestamp, source);

-- Set default for source column so existing constraint works
ALTER TABLE public.generation_readings 
ALTER COLUMN source SET DEFAULT 'csv';

-- Update any existing null sources to 'csv' for backward compat
UPDATE public.generation_readings SET source = 'csv' WHERE source IS NULL;
