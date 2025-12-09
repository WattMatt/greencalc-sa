-- Add project context to scada_imports for linking meters to projects/centres
ALTER TABLE public.scada_imports 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meter_label text,
ADD COLUMN IF NOT EXISTS meter_color text DEFAULT '#3b82f6';

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_scada_imports_project_id ON public.scada_imports(project_id);

-- Create table for storing stacked profile configurations
CREATE TABLE IF NOT EXISTS public.stacked_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  meter_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stacked_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for stacked_profiles
CREATE POLICY "Anyone can view stacked_profiles" ON public.stacked_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stacked_profiles" ON public.stacked_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update stacked_profiles" ON public.stacked_profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete stacked_profiles" ON public.stacked_profiles FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_stacked_profiles_updated_at
BEFORE UPDATE ON public.stacked_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();