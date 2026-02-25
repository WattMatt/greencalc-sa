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
  cb_rating?: string | null;
  shop_type_id: string | null;
  scada_import_id: string | null;
  monthly_kwh_override: number | null;
  include_in_load_profile?: boolean;
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

// --- Configurable TOU Settings ---

export type TOUHourMap = Record<number, TOUPeriod>; // hours 0-23

export interface TOUSeasonConfig {
  weekday: TOUHourMap;
  saturday: TOUHourMap;
  sunday: TOUHourMap;
}

export interface TOUSettings {
  highSeasonMonths: number[]; // 0-indexed months (e.g. [5,6,7] = Jun-Aug)
  highSeason: TOUSeasonConfig;
  lowSeason: TOUSeasonConfig;
}

function buildHourMap(ranges: { start: number; end: number; period: TOUPeriod }[]): TOUHourMap {
  const map: TOUHourMap = {};
  for (let h = 0; h < 24; h++) map[h] = "off-peak";
  for (const { start, end, period } of ranges) {
    for (let h = start; h < end; h++) map[h] = period;
  }
  return map;
}

export const DEFAULT_TOU_SETTINGS: TOUSettings = {
  highSeasonMonths: [5, 6, 7], // June, July, August (0-indexed)
  highSeason: {
    weekday: buildHourMap([
      { start: 6, end: 9, period: "peak" },
      { start: 9, end: 12, period: "standard" },
      { start: 12, end: 14, period: "off-peak" },
      { start: 14, end: 17, period: "standard" },
      { start: 17, end: 19, period: "peak" },
      { start: 19, end: 22, period: "standard" },
    ]),
    saturday: buildHourMap([
      { start: 7, end: 12, period: "standard" },
    ]),
    sunday: buildHourMap([]),
  },
  lowSeason: {
    weekday: buildHourMap([
      { start: 6, end: 7, period: "standard" },
      { start: 7, end: 10, period: "peak" },
      { start: 10, end: 12, period: "standard" },
      { start: 12, end: 18, period: "standard" },
      { start: 18, end: 20, period: "peak" },
      { start: 20, end: 22, period: "standard" },
    ]),
    saturday: buildHourMap([
      { start: 7, end: 12, period: "standard" },
      { start: 18, end: 20, period: "standard" },
    ]),
    sunday: buildHourMap([]),
  },
};

/**
 * Get the TOU period for a given hour.
 * @param hour 0-23
 * @param isWeekend true if Saturday or Sunday
 * @param touSettings optional configurable settings (defaults to DEFAULT_TOU_SETTINGS)
 * @param month optional 0-indexed month to determine season (defaults to low season behaviour)
 * @param dayOfWeek optional 0=Sun..6=Sat for distinguishing Saturday vs Sunday on weekends
 */
/** Read TOU settings from localStorage (inline to avoid circular deps) */
function readStoredTOUSettings(): TOUSettings {
  try {
    const raw = localStorage.getItem("tou-settings");
    if (raw) return JSON.parse(raw) as TOUSettings;
  } catch { /* ignore */ }
  return DEFAULT_TOU_SETTINGS;
}

export const getTOUPeriod = (
  hour: number,
  isWeekend: boolean,
  touSettings?: TOUSettings,
  month?: number,
  dayOfWeek?: number,
): TOUPeriod => {
  const settings = touSettings || readStoredTOUSettings();
  const isHighSeason = month !== undefined ? settings.highSeasonMonths.includes(month) : false;
  const season = isHighSeason ? settings.highSeason : settings.lowSeason;

  let hourMap: TOUHourMap;
  if (!isWeekend) {
    hourMap = season.weekday;
  } else if (dayOfWeek === 0) {
    hourMap = season.sunday;
  } else if (dayOfWeek === 6) {
    hourMap = season.saturday;
  } else {
    // Generic weekend: use saturday map as default
    hourMap = season.saturday;
  }

  return hourMap[hour] || "off-peak";
};

export const TOU_COLORS: Record<TOUPeriod, { fill: string; stroke: string; label: string }> = {
  "peak": { fill: "hsl(0 72% 51%)", stroke: "hsl(0 72% 40%)", label: "Peak" },
  "standard": { fill: "hsl(38 92% 50%)", stroke: "hsl(38 92% 40%)", label: "Standard" },
  "off-peak": { fill: "hsl(160 84% 39%)", stroke: "hsl(160 84% 30%)", label: "Off-Peak" }
};

export const SEASON_COLORS: Record<"high" | "low", { fill: string; label: string }> = {
  high: { fill: "hsl(230 70% 50%)", label: "High-Demand" },
  low: { fill: "hsl(270 50% 60%)", label: "Low-Demand" },
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
