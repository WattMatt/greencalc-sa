-- Create table for custom simulation presets
CREATE TABLE public.simulation_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.simulation_presets ENABLE ROW LEVEL SECURITY;

-- Users can view their own presets
CREATE POLICY "Users can view their own presets"
  ON public.simulation_presets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own presets
CREATE POLICY "Users can create their own presets"
  ON public.simulation_presets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own presets
CREATE POLICY "Users can update their own presets"
  ON public.simulation_presets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own presets
CREATE POLICY "Users can delete their own presets"
  ON public.simulation_presets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_simulation_presets_updated_at
  BEFORE UPDATE ON public.simulation_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();