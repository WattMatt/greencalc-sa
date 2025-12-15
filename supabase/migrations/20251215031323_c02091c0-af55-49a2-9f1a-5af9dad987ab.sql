-- Create proposals table for client-ready solar installation proposals
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.project_simulations(id) ON DELETE SET NULL,
  sandbox_id UUID REFERENCES public.sandbox_simulations(id) ON DELETE SET NULL,
  
  -- Version tracking
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'sent', 'accepted', 'rejected')),
  
  -- Verification checklist
  verification_checklist JSONB NOT NULL DEFAULT '{
    "site_coordinates_verified": false,
    "consumption_data_source": null,
    "tariff_rates_confirmed": false,
    "system_specs_validated": false
  }'::jsonb,
  verification_completed_at TIMESTAMP WITH TIME ZONE,
  verification_completed_by TEXT,
  
  -- Branding
  branding JSONB DEFAULT '{
    "company_name": null,
    "logo_url": null,
    "primary_color": "#22c55e",
    "secondary_color": "#0f172a",
    "contact_email": null,
    "contact_phone": null,
    "website": null,
    "address": null
  }'::jsonb,
  
  -- Report content
  executive_summary TEXT,
  custom_notes TEXT,
  assumptions TEXT,
  disclaimers TEXT DEFAULT 'This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors. Financial projections assume current tariff rates and do not account for future rate changes. All figures are estimates only.',
  
  -- Signature workflow
  prepared_by TEXT,
  prepared_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  client_signature TEXT,
  client_signed_at TIMESTAMP WITH TIME ZONE,
  
  -- Snapshot of simulation data at time of proposal creation
  simulation_snapshot JSONB,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view proposals" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert proposals" ON public.proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update proposals" ON public.proposals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete proposals" ON public.proposals FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_proposals_project_id ON public.proposals(project_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);