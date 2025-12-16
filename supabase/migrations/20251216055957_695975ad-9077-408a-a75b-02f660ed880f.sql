-- Report configurations per proposal
CREATE TABLE public.report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Report',
  template TEXT NOT NULL DEFAULT 'executive', -- executive, technical, financial, custom
  segments JSONB NOT NULL DEFAULT '[]',
  branding JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Version history for reports
CREATE TABLE public.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_config_id UUID NOT NULL REFERENCES public.report_configs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL, -- full report data at this version
  generated_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_configs (same access as proposals)
CREATE POLICY "Anyone can view report_configs"
  ON public.report_configs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert report_configs"
  ON public.report_configs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update report_configs"
  ON public.report_configs FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete report_configs"
  ON public.report_configs FOR DELETE
  USING (true);

-- RLS Policies for report_versions
CREATE POLICY "Anyone can view report_versions"
  ON public.report_versions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert report_versions"
  ON public.report_versions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete report_versions"
  ON public.report_versions FOR DELETE
  USING (true);

-- Indexes for performance
CREATE INDEX idx_report_configs_proposal_id ON public.report_configs(proposal_id);
CREATE INDEX idx_report_versions_config_id ON public.report_versions(report_config_id);

-- Trigger for updated_at
CREATE TRIGGER update_report_configs_updated_at
  BEFORE UPDATE ON public.report_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();