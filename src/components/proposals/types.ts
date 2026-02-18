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

export type ContentBlockCategory = 'general' | 'proposal' | 'monthly_report';

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
  | 'signature'
  // Monthly report blocks
  | 'executiveSummary'
  | 'dailyLog'
  | 'operationalDowntime'
  | 'financialYield';

export interface ContentBlock {
  id: ContentBlockId;
  label: string;
  description: string;
  enabled: boolean;
  required?: boolean;
  order: number;
  category?: ContentBlockCategory;
}

export interface ProposalContentBlocks {
  blocks: ContentBlock[];
}

export const DEFAULT_CONTENT_BLOCKS: ContentBlock[] = [
  // General blocks (shared across all document types)
  { id: 'cover', label: 'Cover Page', description: 'Title page with company details, revision, and document number', enabled: true, order: 0, category: 'general' },
  { id: 'tableOfContents', label: 'Table of Contents', description: 'Section listing with page numbers', enabled: true, order: 1, category: 'general' },
  
  // Proposal-specific blocks
  { id: 'adminDetails', label: 'Administrative Details', description: 'Project location and admin info', enabled: true, order: 2, category: 'proposal' },
  { id: 'introduction', label: 'Introduction', description: 'System description and scope', enabled: true, order: 3, category: 'proposal' },
  { id: 'backgroundMethodology', label: 'Background & Methodology', description: 'Assumptions, tariff tables, and financial return inputs', enabled: true, order: 4, category: 'proposal' },
  { id: 'tenderReturnData', label: 'Tender Return Data', description: 'Capital costs, yield data, panel specs, and load shedding impact', enabled: true, order: 5, category: 'proposal' },
  { id: 'loadAnalysis', label: 'Load Analysis', description: 'Tenant consumption breakdown', enabled: true, order: 6, category: 'proposal' },
  { id: 'financialEstimates', label: 'Financial Estimates', description: 'Financial return outputs per load shedding stage', enabled: true, order: 7, category: 'proposal' },
  { id: 'financialConclusion', label: 'Financial Conclusion', description: 'Recommended baseline stage and key metrics', enabled: true, order: 8, category: 'proposal' },
  { id: 'cashflowTable', label: 'Project Cash Flows', description: 'Landscape 20-year DCF tables per load shedding stage', enabled: true, order: 9, category: 'proposal' },
  { id: 'terms', label: 'Terms & Conditions', description: 'Assumptions and disclaimers', enabled: true, order: 10, category: 'proposal' },
  
  // Monthly report blocks
  { id: 'executiveSummary', label: 'Executive Summary', description: 'Installed equipment specs, monthly and yearly energy generation tables', enabled: true, order: 2, category: 'monthly_report' },
  { id: 'dailyLog', label: 'Daily Performance Log', description: 'Day-by-day yield, metered, downtime, theoretical, and surplus/deficit', enabled: true, order: 3, category: 'monthly_report' },
  { id: 'operationalDowntime', label: 'Operational Downtime', description: 'Downtime details with tie-in breakdowns and comments', enabled: true, order: 4, category: 'monthly_report' },
  { id: 'financialYield', label: 'Financial Yield Report', description: 'Daily financial yield with guarantee vs actual in Rands', enabled: true, order: 5, category: 'monthly_report' },
  
  // General blocks (end)
  { id: 'signature', label: 'Signature Block', description: 'Authorization signatures', enabled: true, order: 99, category: 'general' },
];

/**
 * Returns general blocks + blocks matching the given document type,
 * with correct ordering (general blocks at start/end, type-specific in between).
 */
export function getBlocksForDocumentType(documentType: 'proposal' | 'monthly_report'): ContentBlock[] {
  const filtered = DEFAULT_CONTENT_BLOCKS.filter(
    b => b.category === 'general' || b.category === documentType
  );
  return filtered
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({ ...block, order: index }));
}

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
