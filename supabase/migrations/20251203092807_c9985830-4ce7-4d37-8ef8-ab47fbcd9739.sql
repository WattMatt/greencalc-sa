-- Add extraction status and error tracking to municipalities table
ALTER TABLE public.municipalities 
ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'done', 'error')),
ADD COLUMN IF NOT EXISTS extraction_error text;

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_municipalities_extraction_status ON public.municipalities(extraction_status);