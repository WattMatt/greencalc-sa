export interface RawDataPoint {
  date: string;
  time: string;
  timestamp: string;
  value: number;
}

export interface TenantMeter {
  id: string;
  scada_import_id: string;
  weight: number;
  scada_imports?: {
    id: string;
    shop_name: string | null;
    area_sqm: number | null;
    load_profile_weekday: number[] | null;
    load_profile_weekend: number[] | null;
    detected_interval_minutes?: number | null;
  };
}

export interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  scada_import_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: {
    name: string;
    kwh_per_sqm_month: number;
    load_profile_weekday: number[];
    load_profile_weekend: number[];
  } | null;
  scada_imports?: {
    shop_name: string | null;
    area_sqm: number | null;
    load_profile_weekday: number[] | null;
    load_profile_weekend?: number[] | null;
    detected_interval_minutes?: number | null;
    // raw_data comes from DB as Json, we cast to RawDataPoint[] when using
    raw_data?: unknown;
    date_range_start?: string | null;
    date_range_end?: string | null;
  } | null;
  // Multi-meter support
  tenant_meters?: TenantMeter[];
}

export interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
}

export type DisplayUnit = "kw" | "kva";

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Short day labels for compact weekday selector (Sunday=0 through Saturday=6)
export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Month labels for compact month selector
export const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const DAY_MULTIPLIERS: Record<DayOfWeek, number> = {
  Monday: 0.92,
  Tuesday: 0.96,
  Wednesday: 1.00,
  Thursday: 1.04,
  Friday: 1.08,
  Saturday: 1.05,
  Sunday: 0.88,
};

export const DEFAULT_PROFILE_PERCENT = Array(24).fill(4.17);

export type TOUPeriod = "peak" | "standard" | "off-peak";

export const getTOUPeriod = (hour: number, isWeekend: boolean): TOUPeriod => {
  if (isWeekend) return "off-peak";
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) return "peak";
  if (hour >= 22 || hour < 6) return "off-peak";
  return "standard";
};

export const TOU_COLORS: Record<TOUPeriod, { fill: string; stroke: string; label: string }> = {
  "peak": { fill: "hsl(0 72% 51%)", stroke: "hsl(0 72% 40%)", label: "Peak" },
  "standard": { fill: "hsl(38 92% 50%)", stroke: "hsl(38 92% 40%)", label: "Standard" },
  "off-peak": { fill: "hsl(160 84% 39%)", stroke: "hsl(160 84% 30%)", label: "Off-Peak" }
};

export interface Annotation {
  id: string;
  hour: number;
  text: string;
  color: string;
}

export interface ChartDataPoint {
  hour: string;
  total: number;
  pvGeneration?: number;
  pvDcOutput?: number;
  pvClipping?: number;
  pv1to1Baseline?: number;
  netLoad?: number;
  gridImport?: number;
  gridExport?: number;
  batteryCharge?: number;
  batteryDischarge?: number;
  batterySoC?: number;
  gridImportWithBattery?: number;
  temperature?: number;
  [key: string]: number | string | undefined;
}

export interface OverPanelingStats {
  totalDcOutput: number;
  totalAcOutput: number;
  total1to1Baseline: number;
  additionalKwh: number;
  percentGain: number;
  totalClipping: number;
  clippingPercent: number;
  monthlyAdditionalKwh: number;
  monthlyClipping: number;
  monthly1to1: number;
  monthlyWithOversizing: number;
  annualAdditionalKwh: number;
  annualClipping: number;
  annual1to1: number;
  annualWithOversizing: number;
}

export interface PVStats {
  totalGeneration: number;
  selfConsumption: number;
  selfConsumptionRate: number;
  solarCoverage: number;
}
