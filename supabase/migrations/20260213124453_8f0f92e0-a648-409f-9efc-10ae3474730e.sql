
ALTER TABLE public.generation_source_guarantees
ADD COLUMN meter_type text NOT NULL DEFAULT 'solar';

-- Update any existing council entries (those with 0 guarantee) if needed
-- Users can manually adjust via the UI
