export interface VerificationChecklist {
  site_coordinates_verified: boolean;
  consumption_data_source: 'actual' | 'estimated' | null;
  tariff_rates_confirmed: boolean;
  system_specs_validated: boolean;
}

export interface ProposalBranding {
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
}

export interface Proposal {
  id: string;
  project_id: string;
  simulation_id: string | null;
  sandbox_id: string | null;
  version: number;
  status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'accepted' | 'rejected';
  verification_checklist: VerificationChecklist;
  verification_completed_at: string | null;
  verification_completed_by: string | null;
  branding: ProposalBranding;
  executive_summary: string | null;
  custom_notes: string | null;
  assumptions: string | null;
  disclaimers: string | null;
  prepared_by: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  simulation_snapshot: any;
  created_at: string;
  updated_at: string;
}

export interface SimulationData {
  solarCapacity: number;
  batteryCapacity: number;
  batteryPower: number;
  annualSolarGeneration: number;
  annualGridImport: number;
  annualGridExport: number;
  annualSavings: number;
  paybackYears: number;
  roiPercentage: number;
  systemCost: number;
  tariffName?: string;
  location?: string;
}

export const STATUS_LABELS: Record<Proposal['status'], string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  sent: 'Sent to Client',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  approved: 'bg-green-500/10 text-green-700 border-green-500/30',
  sent: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  accepted: 'bg-primary/10 text-primary border-primary/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};
