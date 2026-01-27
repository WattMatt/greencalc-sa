-- Add validity date columns to tariffs table
ALTER TABLE tariffs 
ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT '2025-07-01',
ADD COLUMN IF NOT EXISTS effective_to DATE DEFAULT '2026-06-30';

-- Add comment for documentation
COMMENT ON COLUMN tariffs.effective_from IS 'Start date of tariff validity period (typically July 1st for SA financial year)';
COMMENT ON COLUMN tariffs.effective_to IS 'End date of tariff validity period (typically June 30th for SA financial year)';