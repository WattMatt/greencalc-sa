// ============= Core Types =============

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

// ============= Enhanced Simulation Data =============

export interface YearlyProjection {
  year: number;
  energyYield: number;
  energyIndex: number;
  energyRate: number;
  energyIncome: number;
  demandSavingKva: number;
  demandIndex: number;
  demandRate: number;
  demandIncome: number;
  totalIncome: number;
  insurance: number;
  oAndM: number;
  totalCost: number;
  replacementCost: number;
  netCashflow: number;
  cumulativeCashflow: number;
}

export interface SensitivityResults {
  bestCase: {
    npv: number;
    irr: number;
    payback: number;
    assumptions: string;
  };
  worstCase: {
    npv: number;
    irr: number;
    payback: number;
    assumptions: string;
  };
}

export interface EquipmentSpecs {
  // Solar Panels
  panelModel?: string;
  panelWattage?: number;
  panelCount?: number;
  panelEfficiency?: number;
  
  // Inverters
  inverterModel?: string;
  inverterPower?: number;
  inverterCount?: number;
  
  // Battery
  batteryModel?: string;
  batteryCapacity?: number;
  batteryPower?: number;
  
  // Installation
  tiltAngle?: number;
  azimuth?: number;
  mountingType?: 'roof' | 'ground' | 'carport';
}

export interface SimulationData {
  // Basic metrics (existing)
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
  
  // Advanced financial metrics
  npv?: number;
  irr?: number;
  mirr?: number;
  lcoe?: number;
  
  // 20-year projection
  yearlyProjections?: YearlyProjection[];
  
  // Sensitivity analysis
  sensitivityResults?: SensitivityResults;
  
  // Equipment specifications
  equipmentSpecs?: EquipmentSpecs;
  
  // Additional details
  selfConsumptionRate?: number;
  gridIndependence?: number;
  co2Avoided?: number;
  demandSavingKva?: number;
}

// ============= Content Blocks =============

export type ContentBlockId = 
  | 'cover'
  | 'executiveSummary'
  | 'siteOverview'
  | 'systemDesign'
  | 'equipmentSpecs'
  | 'loadAnalysis'
  | 'energyFlow'
  | 'financialSummary'
  | 'cashflowTable'
  | 'sensitivityAnalysis'
  | 'terms'
  | 'signature';

export interface ContentBlock {
  id: ContentBlockId;
  label: string;
  description: string;
  enabled: boolean;
  required?: boolean;
  order: number;
}

export interface ProposalContentBlocks {
  blocks: ContentBlock[];
}

export const DEFAULT_CONTENT_BLOCKS: ContentBlock[] = [
  { id: 'cover', label: 'Cover Page', description: 'Title, key metrics, and company branding', enabled: true, required: true, order: 0 },
  { id: 'executiveSummary', label: 'Executive Summary', description: 'High-level overview of the proposal', enabled: true, order: 1 },
  { id: 'siteOverview', label: 'Site Overview', description: 'Location map and site details', enabled: true, order: 2 },
  { id: 'systemDesign', label: 'System Design', description: 'PV layout and floor plan markup', enabled: false, order: 3 },
  { id: 'equipmentSpecs', label: 'Equipment Specifications', description: 'Panel, inverter, and battery details', enabled: true, order: 4 },
  { id: 'loadAnalysis', label: 'Load Analysis', description: 'Tenant consumption breakdown', enabled: true, order: 5 },
  { id: 'energyFlow', label: 'Energy Flow Analysis', description: 'Generation, consumption, and export charts', enabled: true, order: 6 },
  { id: 'financialSummary', label: 'Financial Summary', description: 'NPV, IRR, LCOE, and payback metrics', enabled: true, order: 7 },
  { id: 'cashflowTable', label: '20-Year Cashflow', description: 'Detailed year-by-year projection', enabled: true, order: 8 },
  { id: 'sensitivityAnalysis', label: 'Sensitivity Analysis', description: 'Best/worst case scenarios', enabled: false, order: 9 },
  { id: 'terms', label: 'Terms & Conditions', description: 'Assumptions and disclaimers', enabled: true, order: 10 },
  { id: 'signature', label: 'Signature Block', description: 'Prepared by and client signature', enabled: true, required: true, order: 11 },
];

// ============= Proposal Entity =============

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
  share_token?: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  simulation_snapshot: SimulationData | any | null; // Allow any for DB JSON type compatibility
  content_blocks?: ContentBlock[];
  created_at: string;
  updated_at: string;
}

// ============= Status Display =============

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

// ============= Formatting Helpers =============

export function formatCurrency(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
