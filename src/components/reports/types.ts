// =============================================================================
// REPORT BUILDER TYPES
// =============================================================================

// -----------------------------------------------------------------------------
// Database Types (matches Supabase schema)
// -----------------------------------------------------------------------------

export interface ReportConfig {
  id: string;
  proposal_id: string | null;
  name: string;
  template: ReportTemplate;
  segments: ReportSegment[];
  branding: ReportBranding | null;
  created_at: string;
  updated_at: string;
}

export interface ReportVersion {
  id: string;
  report_config_id: string;
  version: number;
  snapshot: ReportSnapshot;
  generated_by: string | null;
  notes: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Report Templates
// -----------------------------------------------------------------------------

export type ReportTemplate = "executive" | "technical" | "financial" | "custom";

export const REPORT_TEMPLATES: Record<ReportTemplate, { name: string; description: string; defaultSegments: SegmentType[] }> = {
  executive: {
    name: "Executive Summary",
    description: "High-level visual overview for decision makers",
    defaultSegments: ["executive_summary", "dcac_comparison", "payback_timeline", "environmental_impact"]
  },
  technical: {
    name: "Technical Report",
    description: "Detailed engineering specifications and analysis",
    defaultSegments: ["executive_summary", "dcac_comparison", "energy_flow", "monthly_yield", "engineering_specs"]
  },
  financial: {
    name: "Financial Analysis",
    description: "ROI-focused with detailed cost breakdowns",
    defaultSegments: ["executive_summary", "payback_timeline", "savings_breakdown", "monthly_yield"]
  },
  custom: {
    name: "Custom Report",
    description: "Build your own report from available segments",
    defaultSegments: []
  }
};

// -----------------------------------------------------------------------------
// Report Segments
// -----------------------------------------------------------------------------

export type SegmentType =
  | "executive_summary"
  | "dcac_comparison"
  | "energy_flow"
  | "monthly_yield"
  | "payback_timeline"
  | "sensitivity_analysis"
  | "savings_breakdown"
  | "environmental_impact"
  | "engineering_specs"
  | "ai_infographics"
  | "tariff_details"
  | "sizing_comparison"
  | "custom_notes";

export interface ReportSegment {
  id: string;
  type: SegmentType;
  enabled: boolean;
  order: number;
  config?: SegmentConfig;
}

export interface SegmentConfig {
  title?: string;
  showChart?: boolean;
  showTable?: boolean;
  chartSize?: "full" | "half";
  customContent?: string;
}

export const SEGMENT_DEFINITIONS: Record<SegmentType, { name: string; description: string; icon: string; category: "executive" | "charts" | "financial" | "technical" }> = {
  executive_summary: {
    name: "Executive Summary",
    description: "AI-generated overview with key metrics and illustration",
    icon: "Sparkles",
    category: "executive"
  },
  dcac_comparison: {
    name: "DC/AC Ratio Analysis",
    description: "1:1 vs oversizing comparison with clipping analysis",
    icon: "BarChart3",
    category: "charts"
  },
  energy_flow: {
    name: "Energy Flow Diagram",
    description: "Sankey diagram showing generation to consumption flow",
    icon: "GitBranch",
    category: "charts"
  },
  monthly_yield: {
    name: "Monthly Yield Chart",
    description: "12-month production comparison",
    icon: "Calendar",
    category: "charts"
  },
  payback_timeline: {
    name: "Payback Timeline",
    description: "Financial projection with breakeven point",
    icon: "TrendingUp",
    category: "financial"
  },
  sensitivity_analysis: {
    name: "Sensitivity Analysis",
    description: "ROI impact from tariff escalation and system cost changes",
    icon: "TrendingUp",
    category: "financial"
  },
  savings_breakdown: {
    name: "Savings Breakdown",
    description: "Cost savings by TOU period and source",
    icon: "PieChart",
    category: "financial"
  },
  environmental_impact: {
    name: "Environmental Impact",
    description: "CO2 offset and sustainability metrics",
    icon: "Leaf",
    category: "executive"
  },
  engineering_specs: {
    name: "Engineering Specifications",
    description: "Technical system parameters and configuration",
    icon: "Settings",
    category: "technical"
  },
  ai_infographics: {
    name: "AI Infographics",
    description: "Auto-generated professional visual summaries",
    icon: "Sparkles",
    category: "executive"
  },
  tariff_details: {
    name: "Tariff Analysis",
    description: "Detailed breakdown of selected electricity tariff",
    icon: "Zap",
    category: "financial"
  },
  sizing_comparison: {
    name: "Sizing Alternatives",
    description: "Comparison of conservative, current, and aggressive system sizes",
    icon: "Scale",
    category: "technical"
  },
  custom_notes: {
    name: "Custom Notes",
    description: "Free-form text and annotations",
    icon: "FileText",
    category: "executive"
  }
};

// -----------------------------------------------------------------------------
// Report Branding
// -----------------------------------------------------------------------------

export interface ReportBranding {
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  address?: string;
}

// -----------------------------------------------------------------------------
// Report Snapshot (stored in versions)
// -----------------------------------------------------------------------------

export interface ReportSnapshot {
  config: ReportConfig;
  data: ReportData;
  generated_at: string;
}

// -----------------------------------------------------------------------------
// Report Data (calculated values for charts)
// -----------------------------------------------------------------------------

export interface ReportData {
  project: ProjectSummary;
  simulation: SimulationSummary;
  kpis: EngineeringKPIs;
  dcAcAnalysis: DcAcAnalysis;
  financials: FinancialSummary;
  environmental: EnvironmentalMetrics;
}

export interface ProjectSummary {
  name: string;
  location: string | null;
  total_area_sqm: number;
  connection_size_kva: number | null;
  tenant_count: number;
}

export interface SimulationSummary {
  solar_capacity_kwp: number;
  battery_capacity_kwh: number;
  battery_power_kw: number;
  dc_ac_ratio: number;
  annual_solar_generation_kwh: number;
  annual_consumption_kwh: number;
  self_consumption_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
}

// -----------------------------------------------------------------------------
// Engineering KPIs
// -----------------------------------------------------------------------------

export interface EngineeringKPIs {
  /** Energy produced per installed DC capacity (kWh/kWp) */
  specific_yield: number;
  
  /** Actual vs theoretical output (%) */
  performance_ratio: number;
  
  /** Average output vs peak capacity (%) */
  capacity_factor: number;
  
  /** Levelized cost of energy (R/kWh) */
  lcoe: number;
  
  /** PV energy used on-site vs total PV (%) */
  self_consumption_rate: number;
  
  /** Load met by PV vs total load (%) */
  solar_coverage: number;
  
  /** Load met by PV+battery vs total load (%) */
  grid_independence: number;
  
  /** Peak demand reduction achieved (kW) */
  peak_shaving_kw: number;
}

// -----------------------------------------------------------------------------
// DC/AC Ratio Analysis
// -----------------------------------------------------------------------------

export interface DcAcAnalysis {
  /** Baseline 1:1 annual production (kWh) */
  baseline_annual_kwh: number;
  
  /** Oversized DC annual production (kWh) */
  oversized_annual_kwh: number;
  
  /** Energy lost to clipping (kWh) */
  clipping_loss_kwh: number;
  
  /** Additional capture from oversizing (kWh) */
  additional_capture_kwh: number;
  
  /** Net gain from oversizing (kWh) */
  net_gain_kwh: number;
  
  /** Net gain percentage (%) */
  net_gain_percent: number;
  
  /** Clipping as percentage of theoretical DC (%) */
  clipping_percent: number;
  
  /** Hourly comparison data for chart */
  hourly_comparison: HourlyComparison[];
  
  /** Monthly comparison data for chart */
  monthly_comparison: MonthlyComparison[];
}

export interface HourlyComparison {
  hour: number;
  baseline_kw: number;
  oversized_dc_kw: number;
  oversized_ac_kw: number;
  clipping_kw: number;
}

export interface MonthlyComparison {
  month: string;
  baseline_kwh: number;
  oversized_kwh: number;
  gain_kwh: number;
  gain_percent: number;
}

// -----------------------------------------------------------------------------
// Financial Summary
// -----------------------------------------------------------------------------

export interface FinancialSummary {
  /** Total system cost (R) */
  system_cost: number;
  
  /** Annual grid cost without solar (R) */
  annual_grid_cost_baseline: number;
  
  /** Annual grid cost with solar (R) */
  annual_grid_cost_with_solar: number;
  
  /** Annual savings (R) */
  annual_savings: number;
  
  /** Simple payback period (years) */
  payback_years: number;
  
  /** Return on investment (%) */
  roi_percent: number;
  
  /** Net present value (R) */
  npv: number;
  
  /** Internal rate of return (%) */
  irr: number;
  
  /** Yearly cashflow projection */
  yearly_cashflows: YearlyCashflow[];
}

export interface YearlyCashflow {
  year: number;
  cumulative_savings: number;
  cumulative_cost: number;
  net_position: number;
}

// -----------------------------------------------------------------------------
// Environmental Metrics
// -----------------------------------------------------------------------------

export interface EnvironmentalMetrics {
  /** Annual CO2 avoided (tons) */
  co2_avoided_tons: number;
  
  /** Equivalent trees planted */
  trees_equivalent: number;
  
  /** Equivalent car miles avoided */
  car_miles_avoided: number;
  
  /** Equivalent homes powered */
  homes_powered_equivalent: number;
  
  /** Grid emission factor used (kg CO2/kWh) */
  grid_emission_factor: number;
}

// -----------------------------------------------------------------------------
// Chart Export Types
// -----------------------------------------------------------------------------

export type ExportFormat = "pdf" | "excel" | "google_docs" | "google_slides" | "google_sheets";

export interface ExportOptions {
  format: ExportFormat;
  include_cover_page: boolean;
  include_toc: boolean;
  high_resolution: boolean;
}
