-- Create folders table for PV layouts
CREATE TABLE public.pv_layout_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id column to pv_layouts
ALTER TABLE public.pv_layouts 
ADD COLUMN folder_id UUID REFERENCES public.pv_layout_folders(id) ON DELETE SET NULL;

-- Enable RLS on folders table
ALTER TABLE public.pv_layout_folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for folders (matching existing pv_layouts policies)
CREATE POLICY "Anyone can view pv_layout_folders" 
ON public.pv_layout_folders 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert pv_layout_folders" 
ON public.pv_layout_folders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update pv_layout_folders" 
ON public.pv_layout_folders 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete pv_layout_folders" 
ON public.pv_layout_folders 
FOR DELETE 
USING (true);

-- Create trigger for updated_at on folders
CREATE TRIGGER update_pv_layout_folders_updated_at
BEFORE UPDATE ON public.pv_layout_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();