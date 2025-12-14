-- Create sandbox_simulations table for experimental simulations
CREATE TABLE public.sandbox_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cloned_from_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Scenario configurations (up to 3 scenarios for comparison)
  scenario_a JSONB DEFAULT '{"solarCapacity": 100, "batteryCapacity": 0, "dcAcRatio": 1.3}'::jsonb,
  scenario_b JSONB DEFAULT NULL,
  scenario_c JSONB DEFAULT NULL,
  
  -- Parameter sweep configuration
  sweep_config JSONB DEFAULT NULL,
  
  -- Undo/redo history (array of previous states)
  parameter_history JSONB DEFAULT '[]'::jsonb,
  history_index INTEGER DEFAULT 0,
  
  -- Draft status
  is_draft BOOLEAN DEFAULT true,
  draft_notes TEXT,
  
  -- Cloned project data snapshot
  project_snapshot JSONB DEFAULT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sandbox_simulations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view sandbox_simulations" 
ON public.sandbox_simulations 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert sandbox_simulations" 
ON public.sandbox_simulations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update sandbox_simulations" 
ON public.sandbox_simulations 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete sandbox_simulations" 
ON public.sandbox_simulations 
FOR DELETE 
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_sandbox_simulations_updated_at
BEFORE UPDATE ON public.sandbox_simulations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();