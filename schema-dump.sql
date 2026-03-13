-- ============================================================
-- FULL SCHEMA DUMP for target Supabase instance
-- Run this in the SQL Editor of https://lyctmmqndqegptzkajhz.supabase.co
-- ============================================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.charge_type AS ENUM ('basic', 'energy', 'demand', 'network_access', 'network_demand', 'reactive_energy', 'service', 'admin', 'maintenance', 'availability', 'capacity', 'ancillary', 'subsidy', 'surcharge', 'amperage', 'notified_demand');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_category AS ENUM ('domestic', 'domestic_indigent', 'commercial', 'industrial', 'agricultural', 'public_lighting', 'sports_facilities', 'public_benefit', 'bulk_reseller', 'departmental', 'availability', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gantt_dependency_type AS ENUM ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gantt_task_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.metering_type AS ENUM ('prepaid', 'conventional', 'both', 'unmetered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.season_type AS ENUM ('all', 'low', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tariff_structure AS ENUM ('flat', 'inclining_block', 'seasonal', 'time_of_use', 'demand', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tou_period AS ENUM ('all', 'peak', 'standard', 'off_peak');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.voltage_level AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== TABLES (dependency order) ====================

-- provinces
CREATE TABLE IF NOT EXISTS public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- shop_type_categories
CREATE TABLE IF NOT EXISTS public.shop_type_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- shop_types
CREATE TABLE IF NOT EXISTS public.shop_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kwh_per_sqm_month numeric NOT NULL DEFAULT 50,
  load_profile_weekday double precision[] NOT NULL DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17],
  load_profile_weekend double precision[] NOT NULL DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17],
  category_id uuid REFERENCES public.shop_type_categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- checklist_template_groups
CREATE TABLE IF NOT EXISTS public.checklist_template_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- checklist_templates
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'Solar PV',
  sort_order integer NOT NULL DEFAULT 0,
  group_id uuid NOT NULL REFERENCES public.checklist_template_groups(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- sites
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  site_type text,
  total_area_sqm numeric,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- municipalities
CREATE TABLE IF NOT EXISTS public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province_id uuid NOT NULL REFERENCES public.provinces(id),
  financial_year text,
  nersa_increase_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- tariff_plans
CREATE TABLE IF NOT EXISTS public.tariff_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
  name text NOT NULL,
  category public.customer_category NOT NULL DEFAULT 'commercial',
  metering public.metering_type DEFAULT 'conventional',
  structure public.tariff_structure DEFAULT 'flat',
  voltage public.voltage_level DEFAULT 'low',
  min_amps numeric,
  max_amps numeric,
  min_kva numeric,
  max_kva numeric,
  scale_code text,
  phase text,
  is_redundant boolean DEFAULT false,
  is_recommended boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- tariff_rates
CREATE TABLE IF NOT EXISTS public.tariff_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_plan_id uuid NOT NULL REFERENCES public.tariff_plans(id) ON DELETE CASCADE,
  charge public.charge_type NOT NULL DEFAULT 'energy',
  season public.season_type NOT NULL DEFAULT 'all',
  tou public.tou_period NOT NULL DEFAULT 'all',
  amount numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'c/kWh',
  notes text,
  block_number integer,
  block_min_kwh numeric,
  block_max_kwh numeric,
  consumption_threshold_kwh numeric,
  is_above_threshold boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  client_name text,
  logo_url text,
  system_type text DEFAULT 'Solar',
  total_area_sqm numeric,
  connection_size_kva numeric,
  latitude numeric,
  longitude numeric,
  budget numeric,
  target_date date,
  tariff_id uuid REFERENCES public.tariff_plans(id),
  meter_data_prefix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- scada_imports
CREATE TABLE IF NOT EXISTS public.scada_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  shop_number text,
  shop_name text,
  file_name text,
  meter_label text,
  meter_color text DEFAULT '#3b82f6',
  value_unit text DEFAULT 'kWh',
  csv_file_path text,
  raw_data jsonb,
  load_profile_weekday double precision[] DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17],
  load_profile_weekend double precision[] DEFAULT ARRAY[4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17,4.17],
  data_points integer DEFAULT 0,
  date_range_start date,
  date_range_end date,
  weekday_days integer DEFAULT 0,
  weekend_days integer DEFAULT 0,
  area_sqm numeric,
  detected_interval_minutes integer,
  processed_at timestamptz,
  project_id uuid REFERENCES public.projects(id),
  site_id uuid REFERENCES public.sites(id),
  category_id uuid REFERENCES public.shop_type_categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_tenants
CREATE TABLE IF NOT EXISTS public.project_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  area_sqm numeric NOT NULL,
  shop_name text,
  shop_number text,
  cb_rating text,
  monthly_kwh_override numeric,
  include_in_load_profile boolean DEFAULT true,
  is_virtual boolean DEFAULT false,
  scada_import_id uuid REFERENCES public.scada_imports(id),
  shop_type_id uuid REFERENCES public.shop_types(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_tenant_meters
CREATE TABLE IF NOT EXISTS public.project_tenant_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.project_tenants(id),
  scada_import_id uuid NOT NULL REFERENCES public.scada_imports(id),
  weight numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- generation_records
CREATE TABLE IF NOT EXISTS public.generation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  month integer NOT NULL,
  year integer NOT NULL,
  actual_kwh numeric,
  guaranteed_kwh numeric,
  expected_kwh numeric,
  building_load_kwh numeric,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- generation_readings
CREATE TABLE IF NOT EXISTS public.generation_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  timestamp timestamptz NOT NULL,
  actual_kwh numeric,
  building_load_kwh numeric,
  source text DEFAULT 'csv',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- generation_daily_records
CREATE TABLE IF NOT EXISTS public.generation_daily_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  date date NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  actual_kwh numeric,
  building_load_kwh numeric,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- generation_source_guarantees
CREATE TABLE IF NOT EXISTS public.generation_source_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  source_label text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  guaranteed_kwh numeric NOT NULL DEFAULT 0,
  meter_type text NOT NULL DEFAULT 'solar',
  reading_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_simulations
CREATE TABLE IF NOT EXISTS public.project_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  simulation_type text DEFAULT 'solar',
  solar_capacity_kwp numeric,
  solar_orientation text,
  solar_tilt_degrees numeric,
  battery_capacity_kwh numeric,
  battery_power_kw numeric,
  annual_solar_savings numeric,
  annual_battery_savings numeric,
  annual_grid_cost numeric,
  payback_years numeric,
  roi_percentage numeric,
  results_json jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- pv_layout_folders
CREATE TABLE IF NOT EXISTS public.pv_layout_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- pv_layouts
CREATE TABLE IF NOT EXISTS public.pv_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL DEFAULT 'Default Layout',
  pdf_data text,
  scale_pixels_per_meter numeric,
  pv_config jsonb DEFAULT '{"tiltAngle": 10, "panelWidth": 1.134, "rowSpacing": 0.5, "orientation": "portrait", "panelHeight": 2.278, "panelWattage": 550}'::jsonb,
  roof_masks jsonb DEFAULT '[]'::jsonb,
  pv_arrays jsonb DEFAULT '[]'::jsonb,
  equipment jsonb DEFAULT '[]'::jsonb,
  cables jsonb DEFAULT '[]'::jsonb,
  plant_setup jsonb,
  folder_id uuid REFERENCES public.pv_layout_folders(id),
  simulation_id uuid REFERENCES public.project_simulations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_solar_data
CREATE TABLE IF NOT EXISTS public.project_solar_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  data_type text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  data_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_tasks
CREATE TABLE IF NOT EXISTS public.gantt_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  description text,
  owner text,
  color text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.gantt_task_status NOT NULL DEFAULT 'not_started',
  progress integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_milestones
CREATE TABLE IF NOT EXISTS public.gantt_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  description text,
  color text,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_baselines
CREATE TABLE IF NOT EXISTS public.gantt_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_baseline_tasks
CREATE TABLE IF NOT EXISTS public.gantt_baseline_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.gantt_baselines(id),
  task_id uuid NOT NULL REFERENCES public.gantt_tasks(id),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_task_dependencies
CREATE TABLE IF NOT EXISTS public.gantt_task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id uuid NOT NULL REFERENCES public.gantt_tasks(id),
  successor_id uuid NOT NULL REFERENCES public.gantt_tasks(id),
  dependency_type public.gantt_dependency_type NOT NULL DEFAULT 'finish_to_start',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- gantt_task_segments
CREATE TABLE IF NOT EXISTS public.gantt_task_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.gantt_tasks(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- sandbox_simulations
CREATE TABLE IF NOT EXISTS public.sandbox_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  draft_notes text,
  cloned_from_project_id uuid REFERENCES public.projects(id),
  scenario_a jsonb DEFAULT '{"dcAcRatio": 1.3, "solarCapacity": 100, "batteryCapacity": 0}'::jsonb,
  scenario_b jsonb,
  scenario_c jsonb,
  sweep_config jsonb,
  parameter_history jsonb DEFAULT '[]'::jsonb,
  history_index integer DEFAULT 0,
  is_draft boolean DEFAULT true,
  project_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  simulation_id uuid REFERENCES public.project_simulations(id),
  sandbox_id uuid REFERENCES public.sandbox_simulations(id),
  document_type text NOT NULL DEFAULT 'proposal',
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  executive_summary text,
  custom_notes text,
  assumptions text,
  disclaimers text DEFAULT 'This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors. Financial projections assume current tariff rates and do not account for future rate changes. All figures are estimates only.',
  prepared_by text,
  reviewed_by text,
  approved_by text,
  client_signature text,
  share_token text,
  verification_completed_by text,
  verification_checklist jsonb NOT NULL DEFAULT '{"system_specs_validated": false, "tariff_rates_confirmed": false, "consumption_data_source": null, "site_coordinates_verified": false}'::jsonb,
  verification_completed_at timestamptz,
  branding jsonb DEFAULT '{"address": null, "website": null, "logo_url": null, "company_name": null, "contact_email": null, "contact_phone": null, "primary_color": "#22c55e", "secondary_color": "#0f172a"}'::jsonb,
  simulation_snapshot jsonb,
  content_blocks jsonb,
  section_overrides jsonb,
  prepared_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  client_signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- stacked_profiles
CREATE TABLE IF NOT EXISTS public.stacked_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  name text NOT NULL,
  description text,
  meter_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_document_folders
CREATE TABLE IF NOT EXISTS public.project_document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_documents
CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  folder_id uuid REFERENCES public.project_document_folders(id),
  name text NOT NULL,
  file_path text,
  file_size integer,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_schematics
CREATE TABLE IF NOT EXISTS public.project_schematics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL,
  description text,
  file_path text,
  file_type text,
  converted_image_path text,
  page_number integer DEFAULT 1,
  total_pages integer DEFAULT 1,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_schematic_meter_positions
CREATE TABLE IF NOT EXISTS public.project_schematic_meter_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_id uuid NOT NULL REFERENCES public.project_schematics(id),
  meter_id text NOT NULL,
  label text,
  x_position numeric NOT NULL DEFAULT 0,
  y_position numeric NOT NULL DEFAULT 0,
  scale_x numeric DEFAULT 1.0,
  scale_y numeric DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- project_schematic_lines
CREATE TABLE IF NOT EXISTS public.project_schematic_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_id uuid NOT NULL REFERENCES public.project_schematics(id),
  line_type text DEFAULT 'solid',
  from_x numeric DEFAULT 0,
  from_y numeric DEFAULT 0,
  to_x numeric DEFAULT 0,
  to_y numeric DEFAULT 0,
  color text,
  stroke_width numeric,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- project_meter_connections
CREATE TABLE IF NOT EXISTS public.project_meter_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  parent_meter_id text NOT NULL,
  child_meter_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- organization_branding
CREATE TABLE IF NOT EXISTS public.organization_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text,
  logo_url text,
  primary_color text DEFAULT '#3b82f6',
  secondary_color text DEFAULT '#1e40af',
  contact_email text,
  contact_phone text,
  website text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- report_configs
CREATE TABLE IF NOT EXISTS public.report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT 'Untitled Report',
  template text DEFAULT 'standard',
  segments jsonb DEFAULT '[]'::jsonb,
  branding jsonb,
  proposal_id uuid REFERENCES public.proposals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- report_versions
CREATE TABLE IF NOT EXISTS public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_config_id uuid NOT NULL REFERENCES public.report_configs(id),
  version integer DEFAULT 1,
  snapshot jsonb NOT NULL,
  notes text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- report_analytics
CREATE TABLE IF NOT EXISTS public.report_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  report_config_id uuid REFERENCES public.report_configs(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- handover_checklist_items
CREATE TABLE IF NOT EXISTS public.handover_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  template_id uuid REFERENCES public.checklist_templates(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- checklist_document_links
CREATE TABLE IF NOT EXISTS public.checklist_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.handover_checklist_items(id),
  document_id uuid NOT NULL REFERENCES public.project_documents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- downtime_slot_overrides
CREATE TABLE IF NOT EXISTS public.downtime_slot_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  reading_source text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  slot_override integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- downtime_comments
CREATE TABLE IF NOT EXISTS public.downtime_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- eskom_batch_status
CREATE TABLE IF NOT EXISTS public.eskom_batch_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
  batch_name text NOT NULL,
  batch_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tariffs_extracted integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- extraction_runs
CREATE TABLE IF NOT EXISTS public.extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
  run_type text NOT NULL DEFAULT 'extraction',
  status text NOT NULL DEFAULT 'pending',
  source_file_path text,
  source_file_name text,
  ai_analysis text,
  ai_confidence integer,
  tariffs_found integer DEFAULT 0,
  tariffs_inserted integer DEFAULT 0,
  tariffs_updated integer DEFAULT 0,
  tariffs_skipped integer DEFAULT 0,
  corrections_made integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- simulation_presets
CREATE TABLE IF NOT EXISTS public.simulation_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
