-- Projects table for energy modeling projects (e.g., shopping centres)
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  total_area_sqm NUMERIC,
  tariff_id UUID REFERENCES public.tariffs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shop types with their load profile data (hourly percentages)
CREATE TABLE public.shop_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Load profile: 24 hourly values (percentage of daily consumption per hour)
  load_profile_weekday NUMERIC[] NOT NULL DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17]::NUMERIC[],
  load_profile_weekend NUMERIC[] NOT NULL DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17]::NUMERIC[],
  -- Typical consumption per sqm per month (kWh/sqm/month)
  kwh_per_sqm_month NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project tenants (shops within a project)
CREATE TABLE public.project_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shop_type_id UUID REFERENCES public.shop_types(id),
  name TEXT NOT NULL,
  area_sqm NUMERIC NOT NULL,
  -- Optional override for monthly consumption
  monthly_kwh_override NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Energy simulations for projects
CREATE TABLE public.project_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  simulation_type TEXT NOT NULL DEFAULT 'solar_battery', -- solar_only, solar_battery, full_analysis
  -- Solar parameters
  solar_capacity_kwp NUMERIC,
  solar_orientation TEXT DEFAULT 'North',
  solar_tilt_degrees NUMERIC DEFAULT 25,
  -- Battery parameters
  battery_capacity_kwh NUMERIC,
  battery_power_kw NUMERIC,
  -- Results (stored after simulation)
  annual_grid_cost NUMERIC,
  annual_solar_savings NUMERIC,
  annual_battery_savings NUMERIC,
  payback_years NUMERIC,
  roi_percentage NUMERIC,
  results_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for now, can be restricted later with auth)
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Anyone can insert projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete projects" ON public.projects FOR DELETE USING (true);

CREATE POLICY "Anyone can view shop_types" ON public.shop_types FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop_types" ON public.shop_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop_types" ON public.shop_types FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shop_types" ON public.shop_types FOR DELETE USING (true);

CREATE POLICY "Anyone can view project_tenants" ON public.project_tenants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project_tenants" ON public.project_tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project_tenants" ON public.project_tenants FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete project_tenants" ON public.project_tenants FOR DELETE USING (true);

CREATE POLICY "Anyone can view project_simulations" ON public.project_simulations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project_simulations" ON public.project_simulations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project_simulations" ON public.project_simulations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete project_simulations" ON public.project_simulations FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shop_types_updated_at BEFORE UPDATE ON public.shop_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_tenants_updated_at BEFORE UPDATE ON public.project_tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_simulations_updated_at BEFORE UPDATE ON public.project_simulations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();