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
  | 'tableOfContents'
  | 'adminDetails'
  | 'introduction'
  | 'backgroundMethodology'
  | 'tenderReturnData'
  | 'loadAnalysis'
  | 'financialEstimates'
  | 'financialConclusion'
  | 'cashflowTable'
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
  { id: 'cover', label: 'Cover Page', description: 'Title page with company details, revision, and document number', enabled: true, required: true, order: 0 },
  { id: 'tableOfContents', label: 'Table of Contents', description: 'Section listing with page numbers', enabled: true, order: 1 },
  { id: 'adminDetails', label: 'Administrative Details', description: 'Project location and admin info', enabled: true, order: 2 },
  { id: 'introduction', label: 'Introduction', description: 'System description and scope', enabled: true, order: 3 },
  { id: 'backgroundMethodology', label: 'Background & Methodology', description: 'Assumptions, tariff tables, and financial return inputs', enabled: true, order: 4 },
  { id: 'tenderReturnData', label: 'Tender Return Data', description: 'Capital costs, yield data, panel specs, and load shedding impact', enabled: true, order: 5 },
  { id: 'loadAnalysis', label: 'Load Analysis', description: 'Tenant consumption breakdown', enabled: true, order: 6 },
  { id: 'financialEstimates', label: 'Financial Estimates', description: 'Financial return outputs per load shedding stage', enabled: true, order: 7 },
  { id: 'financialConclusion', label: 'Financial Conclusion', description: 'Recommended baseline stage and key metrics', enabled: true, order: 8 },
  { id: 'cashflowTable', label: 'Project Cash Flows', description: 'Landscape 20-year DCF tables per load shedding stage', enabled: true, order: 9 },
  { id: 'terms', label: 'Terms & Conditions', description: 'Assumptions and disclaimers', enabled: true, order: 10 },
  { id: 'signature', label: 'Signature Block', description: 'Authorization signatures', enabled: true, required: true, order: 11 },
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

// ============= LaTeX Section Delimiters =============

export const SECTION_BEGIN = (id: string) => `%%-- BEGIN:${id} --%%`;
export const SECTION_END = (id: string) => `%%-- END:${id} --%%`;
export const SECTION_REGEX = /%%-- BEGIN:(\w+) --%%\n([\s\S]*?)\n%%-- END:\1 --%%/g;

export type SectionOverrides = Record<string, string>;

export function parseSections(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = new RegExp(SECTION_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(source)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

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
