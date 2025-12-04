-- Add scoring columns to municipalities table for summary view
ALTER TABLE public.municipalities
ADD COLUMN IF NOT EXISTS extraction_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_confidence integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_tariffs integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_extraction_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_reprise_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reprise_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_corrections integer DEFAULT 0;

-- Create extraction runs table for detailed audit trail
CREATE TABLE public.extraction_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('extraction', 'reprise')),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone DEFAULT NULL,
  
  -- Counts
  tariffs_found integer DEFAULT 0,
  tariffs_inserted integer DEFAULT 0,
  tariffs_updated integer DEFAULT 0,
  tariffs_skipped integer DEFAULT 0,
  corrections_made integer DEFAULT 0,
  
  -- AI metrics
  ai_confidence integer DEFAULT NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  ai_analysis text DEFAULT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text DEFAULT NULL,
  
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;

-- Create policies for extraction_runs
CREATE POLICY "Anyone can view extraction runs" 
ON public.extraction_runs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all inserts on extraction_runs" 
ON public.extraction_runs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all updates on extraction_runs" 
ON public.extraction_runs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow all deletes on extraction_runs" 
ON public.extraction_runs 
FOR DELETE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_extraction_runs_municipality ON public.extraction_runs(municipality_id);
CREATE INDEX idx_extraction_runs_type ON public.extraction_runs(run_type);
CREATE INDEX idx_extraction_runs_started ON public.extraction_runs(started_at DESC);