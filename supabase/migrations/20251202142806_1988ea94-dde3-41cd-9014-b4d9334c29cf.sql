-- Create enum types for tariff structure
CREATE TYPE public.tariff_type AS ENUM ('Fixed', 'IBT', 'TOU');
CREATE TYPE public.phase_type AS ENUM ('Single Phase', 'Three Phase');
CREATE TYPE public.season_type AS ENUM ('All Year', 'High/Winter', 'Low/Summer');
CREATE TYPE public.time_of_use_type AS ENUM ('Any', 'Peak', 'Standard', 'Off-Peak');

-- Provinces table
CREATE TABLE public.provinces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Municipalities table
CREATE TABLE public.municipalities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  increase_percentage DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(province_id, name)
);

-- Tariff categories table
CREATE TABLE public.tariff_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tariffs table
CREATE TABLE public.tariffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.tariff_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tariff_type public.tariff_type NOT NULL DEFAULT 'Fixed',
  phase_type public.phase_type DEFAULT 'Single Phase',
  amperage_limit TEXT,
  fixed_monthly_charge DECIMAL(12,2) DEFAULT 0,
  demand_charge_per_kva DECIMAL(12,2) DEFAULT 0,
  network_access_charge DECIMAL(12,2) DEFAULT 0,
  has_seasonal_rates BOOLEAN DEFAULT false,
  is_prepaid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tariff rates table (handles IBT blocks, TOU periods, seasonal rates)
CREATE TABLE public.tariff_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tariff_id UUID NOT NULL REFERENCES public.tariffs(id) ON DELETE CASCADE,
  season public.season_type NOT NULL DEFAULT 'All Year',
  time_of_use public.time_of_use_type NOT NULL DEFAULT 'Any',
  block_start_kwh INTEGER DEFAULT 0,
  block_end_kwh INTEGER,
  rate_per_kwh DECIMAL(12,4) NOT NULL,
  demand_charge_per_kva DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_municipalities_province ON public.municipalities(province_id);
CREATE INDEX idx_tariffs_municipality ON public.tariffs(municipality_id);
CREATE INDEX idx_tariffs_category ON public.tariffs(category_id);
CREATE INDEX idx_tariff_rates_tariff ON public.tariff_rates(tariff_id);

-- Enable Row Level Security (public read for tariff data)
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rates ENABLE ROW LEVEL SECURITY;

-- Public read policies (tariff data should be publicly readable)
CREATE POLICY "Anyone can view provinces" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "Anyone can view municipalities" ON public.municipalities FOR SELECT USING (true);
CREATE POLICY "Anyone can view tariff categories" ON public.tariff_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view tariffs" ON public.tariffs FOR SELECT USING (true);
CREATE POLICY "Anyone can view tariff rates" ON public.tariff_rates FOR SELECT USING (true);

-- Admin write policies (for now, allow all writes - you can restrict to authenticated users later)
CREATE POLICY "Allow all inserts on provinces" ON public.provinces FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on provinces" ON public.provinces FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on provinces" ON public.provinces FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on municipalities" ON public.municipalities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on municipalities" ON public.municipalities FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on municipalities" ON public.municipalities FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on tariff_categories" ON public.tariff_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on tariff_categories" ON public.tariff_categories FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on tariff_categories" ON public.tariff_categories FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on tariffs" ON public.tariffs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on tariffs" ON public.tariffs FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on tariffs" ON public.tariffs FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on tariff_rates" ON public.tariff_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on tariff_rates" ON public.tariff_rates FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on tariff_rates" ON public.tariff_rates FOR DELETE USING (true);

-- Insert default tariff categories
INSERT INTO public.tariff_categories (name, description) VALUES 
  ('Domestic', 'Residential electricity tariffs'),
  ('Commercial', 'Business and commercial tariffs'),
  ('Industrial', 'Industrial and manufacturing tariffs'),
  ('Agricultural', 'Farming and agricultural tariffs');

-- Insert Eastern Cape Province
INSERT INTO public.provinces (name) VALUES ('Eastern Cape');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_provinces_updated_at BEFORE UPDATE ON public.provinces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_municipalities_updated_at BEFORE UPDATE ON public.municipalities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tariffs_updated_at BEFORE UPDATE ON public.tariffs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();