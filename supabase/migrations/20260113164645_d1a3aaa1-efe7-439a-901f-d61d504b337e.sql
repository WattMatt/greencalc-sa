-- Add processed_at column to track reprocessing status
ALTER TABLE public.scada_imports 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient filtering of unprocessed meters
CREATE INDEX IF NOT EXISTS idx_scada_imports_processed_at ON public.scada_imports(processed_at);

-- Comment for clarity
COMMENT ON COLUMN public.scada_imports.processed_at IS 'Timestamp when the meter was last successfully reprocessed. NULL means never processed or needs reprocessing.';