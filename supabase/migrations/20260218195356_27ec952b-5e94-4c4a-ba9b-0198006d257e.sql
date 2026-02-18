
-- Create extraction_runs table for tracking AI extraction passes
CREATE TABLE public.extraction_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL DEFAULT 'extraction',
  tariffs_found INTEGER DEFAULT 0,
  tariffs_inserted INTEGER DEFAULT 0,
  tariffs_updated INTEGER DEFAULT 0,
  tariffs_skipped INTEGER DEFAULT 0,
  corrections_made INTEGER DEFAULT 0,
  ai_confidence INTEGER,
  ai_analysis TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read extraction_runs" ON public.extraction_runs FOR SELECT USING (true);
CREATE POLICY "Authenticated write extraction_runs" ON public.extraction_runs FOR ALL USING (true) WITH CHECK (true);

-- Create eskom_batch_status table for tracking Eskom batch extraction progress
CREATE TABLE public.eskom_batch_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  batch_index INTEGER NOT NULL,
  batch_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tariffs_extracted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eskom_batch_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read eskom_batch_status" ON public.eskom_batch_status FOR SELECT USING (true);
CREATE POLICY "Authenticated write eskom_batch_status" ON public.eskom_batch_status FOR ALL USING (true) WITH CHECK (true);

-- Add unique constraint for batch tracking
CREATE UNIQUE INDEX idx_eskom_batch_unique ON public.eskom_batch_status(municipality_id, batch_index);

-- Add trigger for updated_at
CREATE TRIGGER update_eskom_batch_status_updated_at
  BEFORE UPDATE ON public.eskom_batch_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
