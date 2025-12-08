-- Create table for storing SCADA/meter imports as global reference data
CREATE TABLE public.scada_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name TEXT NOT NULL,
  shop_number TEXT,
  shop_name TEXT,
  file_name TEXT,
  
  -- Raw time-series data stored as JSONB array
  -- Each entry: { timestamp: string, value: number }
  raw_data JSONB,
  
  -- Generated 24-hour load profiles (cached for quick access)
  load_profile_weekday NUMERIC[] DEFAULT ARRAY[4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17],
  load_profile_weekend NUMERIC[] DEFAULT ARRAY[4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17],
  
  -- Metadata from processing
  data_points INTEGER DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  weekday_days INTEGER DEFAULT 0,
  weekend_days INTEGER DEFAULT 0,
  
  -- Category link (optional - for assisting with shop type categorization)
  category_id UUID REFERENCES public.shop_type_categories(id) ON DELETE SET NULL,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scada_imports ENABLE ROW LEVEL SECURITY;

-- Policies for global access (public reference library)
CREATE POLICY "Anyone can view scada_imports"
  ON public.scada_imports
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert scada_imports"
  ON public.scada_imports
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update scada_imports"
  ON public.scada_imports
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete scada_imports"
  ON public.scada_imports
  FOR DELETE
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_scada_imports_updated_at
  BEFORE UPDATE ON public.scada_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for common lookups
CREATE INDEX idx_scada_imports_site_name ON public.scada_imports(site_name);
CREATE INDEX idx_scada_imports_shop_name ON public.scada_imports(shop_name);