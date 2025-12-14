import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Settings2, ChevronDown, Info, MapPin, Compass, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// South African cities with solar resource data (GHI in kWh/m²/day, DNI in kWh/m²/day)
// Based on PVGIS and NREL data for South Africa
export const SA_SOLAR_LOCATIONS = {
  johannesburg: { name: "Johannesburg", lat: -26.2, ghi: 5.4, dni: 5.9, optimalTilt: 26 },
  capetown: { name: "Cape Town", lat: -33.9, ghi: 5.3, dni: 6.2, optimalTilt: 34 },
  durban: { name: "Durban", lat: -29.9, ghi: 4.9, dni: 5.1, optimalTilt: 30 },
  pretoria: { name: "Pretoria", lat: -25.7, ghi: 5.5, dni: 6.0, optimalTilt: 26 },
  bloemfontein: { name: "Bloemfontein", lat: -29.1, ghi: 5.7, dni: 6.5, optimalTilt: 29 },
  port_elizabeth: { name: "Port Elizabeth", lat: -33.9, ghi: 5.1, dni: 5.7, optimalTilt: 34 },
  upington: { name: "Upington (Northern Cape)", lat: -28.5, ghi: 6.2, dni: 7.3, optimalTilt: 29 },
  polokwane: { name: "Polokwane", lat: -23.9, ghi: 5.6, dni: 6.1, optimalTilt: 24 },
  nelspruit: { name: "Nelspruit", lat: -25.5, ghi: 5.3, dni: 5.6, optimalTilt: 26 },
  kimberley: { name: "Kimberley", lat: -28.7, ghi: 5.9, dni: 6.8, optimalTilt: 29 },
};

export type LocationKey = keyof typeof SA_SOLAR_LOCATIONS;

// Module types with efficiency multipliers (relative to standard)
export const MODULE_TYPES = {
  standard: { name: "Standard (Poly/Mono)", efficiency: 1.0, description: "Typical crystalline silicon modules" },
  premium: { name: "Premium (High-Eff Mono)", efficiency: 1.05, description: "High-efficiency monocrystalline" },
  thinfilm: { name: "Thin Film (CdTe/CIGS)", efficiency: 0.92, description: "Better in high temps, lower efficiency" },
};

export type ModuleType = keyof typeof MODULE_TYPES;

// Array types with performance modifiers
export const ARRAY_TYPES = {
  fixed_roof: { name: "Fixed (Roof Mount)", modifier: 0.98, description: "Roof-mounted, reduced ventilation" },
  fixed_ground: { name: "Fixed (Ground/Open Rack)", modifier: 1.0, description: "Ground-mounted with good airflow" },
  tracking_1axis: { name: "1-Axis Tracking", modifier: 1.25, description: "Horizontal N-S axis tracking" },
  tracking_2axis: { name: "2-Axis Tracking", modifier: 1.35, description: "Full sun tracking, maximum yield" },
};

export type ArrayType = keyof typeof ARRAY_TYPES;

// Default system losses breakdown (from PVWatts)
export const DEFAULT_LOSSES = {
  soiling: 2.0,
  shading: 3.0,
  snow: 0.0,
  mismatch: 2.0,
  wiring: 2.0,
  connections: 0.5,
  lightInducedDegradation: 1.5,
  nameplateRating: 1.0,
  age: 0.0,
  availability: 3.0,
};

export type SystemLosses = typeof DEFAULT_LOSSES;

export interface PVSystemConfigData {
  location: LocationKey;
  moduleType: ModuleType;
  arrayType: ArrayType;
  tilt: number;
  azimuth: number;
  dcAcRatio: number;
  inverterEfficiency: number;
  losses: SystemLosses;
  totalLossPercent: number;
  groundCoverageRatio: number;
  bifacial: boolean;
  albedo: number;
}

interface PVSystemConfigProps {
  config: PVSystemConfigData;
  onChange: (config: PVSystemConfigData) => void;
  maxSolarKva?: number | null;
  solarCapacity: number;
}

export function getDefaultPVConfig(): PVSystemConfigData {
  const totalLoss = Object.values(DEFAULT_LOSSES).reduce((a, b) => a + b, 0);
  return {
    location: "johannesburg",
    moduleType: "standard",
    arrayType: "fixed_roof",
    tilt: 26,
    azimuth: 0, // North-facing in Southern hemisphere
    dcAcRatio: 1.3,
    inverterEfficiency: 96,
    losses: { ...DEFAULT_LOSSES },
    totalLossPercent: totalLoss,
    groundCoverageRatio: 0.4,
    bifacial: false,
    albedo: 0.2,
  };
}

export function calculateTotalLoss(losses: SystemLosses): number {
  // Losses are multiplicative, not additive
  // Total loss = 1 - (1-loss1) * (1-loss2) * ... * (1-lossN)
  let remaining = 1;
  Object.values(losses).forEach(loss => {
    remaining *= (1 - loss / 100);
  });
  return (1 - remaining) * 100;
}

export function calculateSystemEfficiency(config: PVSystemConfigData): number {
  const moduleEff = MODULE_TYPES[config.moduleType].efficiency;
  const arrayMod = ARRAY_TYPES[config.arrayType].modifier;
  const inverterEff = config.inverterEfficiency / 100;
  const lossMultiplier = 1 - config.totalLossPercent / 100;
  
  // Tilt factor (simplified - optimal when tilt ≈ latitude)
  const location = SA_SOLAR_LOCATIONS[config.location];
  const optimalTilt = Math.abs(location.lat);
  const tiltDiff = Math.abs(config.tilt - optimalTilt);
  const tiltFactor = 1 - (tiltDiff / 90) * 0.15; // Max 15% loss for 90° deviation
  
  // Azimuth factor (optimal = 0° for N-facing in S hemisphere)
  const azimuthFactor = 1 - (Math.abs(config.azimuth) / 180) * 0.25; // Max 25% loss for E/W facing
  
  return moduleEff * arrayMod * inverterEff * lossMultiplier * tiltFactor * azimuthFactor;
}

// Hourly GHI data from Solcast (optional, for real irradiance data)
export interface HourlyIrradianceData {
  hour: number;
  ghi: number; // W/m²
  dni?: number;
  dhi?: number;
}

// Generate hourly solar profile based on location and configuration
// If hourlyGhi is provided (from Solcast), use real irradiance data instead of Gaussian model
export function generateSolarProfile(
  config: PVSystemConfigData, 
  capacityKwp: number,
  hourlyGhi?: HourlyIrradianceData[]
): number[] {
  const location = SA_SOLAR_LOCATIONS[config.location];
  const efficiency = calculateSystemEfficiency(config);
  
  // If we have real Solcast hourly data, use it
  if (hourlyGhi && hourlyGhi.length === 24) {
    const profile: number[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourlyGhi.find(h => h.hour === hour);
      const ghiWm2 = hourData?.ghi ?? 0;
      
      // Convert W/m² to kWh output for this hour
      // GHI in W/m² × 1 hour = Wh/m², divide by 1000 = kWh/m²
      // Then multiply by capacity and efficiency
      const ghiKwhM2 = ghiWm2 / 1000; // kWh/m² for this hour
      const hourlyOutput = capacityKwp * ghiKwhM2 * efficiency;
      profile.push(Math.max(0, hourlyOutput));
    }
    
    return profile;
  }
  
  // Fallback: Base solar curve (Gaussian-like, peak at solar noon)
  const profile: number[] = [];
  const peakHour = 12.5; // Solar noon slightly after 12:00
  const sigma = 3.5; // Width of the curve (hours)
  
  // Tracking arrays have wider effective curves
  const trackingBonus = config.arrayType.includes("tracking") 
    ? (config.arrayType === "tracking_2axis" ? 2.5 : 1.5) 
    : 0;
  const effectiveSigma = sigma + trackingBonus;
  
  for (let hour = 0; hour < 24; hour++) {
    const hourMid = hour + 0.5;
    // Gaussian curve for solar intensity
    const intensity = Math.exp(-Math.pow(hourMid - peakHour, 2) / (2 * effectiveSigma * effectiveSigma));
    
    // Only generate during daylight (roughly 5am - 7pm)
    const daylight = hour >= 5 && hour <= 19;
    
    if (daylight && intensity > 0.01) {
      // Convert GHI to hourly kWh output
      // Daily GHI spread across peak sun hours (approximately 5-6 hours equivalent)
      const peakSunHours = location.ghi / 1.0; // GHI is already in kWh/m²/day
      const hourlyOutput = capacityKwp * intensity * efficiency * (peakSunHours / 6);
      profile.push(Math.max(0, hourlyOutput));
    } else {
      profile.push(0);
    }
  }
  
  // Normalize to match expected daily generation
  const totalGenerated = profile.reduce((a, b) => a + b, 0);
  const expectedDaily = capacityKwp * location.ghi * efficiency * 0.9; // 0.9 for realistic factor
  const scaleFactor = expectedDaily / (totalGenerated || 1);
  
  return profile.map(v => v * scaleFactor);
}

// Generate an average daily profile from Solcast multi-day forecast
export function generateAverageSolcastProfile(
  hourlyForecasts: Array<{ period_end: string; ghi: number; dni?: number; dhi?: number }>
): HourlyIrradianceData[] {
  const hourlyTotals: { [hour: number]: { sum: number; count: number } } = {};
  
  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    hourlyTotals[h] = { sum: 0, count: 0 };
  }
  
  // Aggregate by hour of day
  hourlyForecasts.forEach(forecast => {
    const date = new Date(forecast.period_end);
    const hour = date.getUTCHours();
    if (hour >= 0 && hour < 24) {
      hourlyTotals[hour].sum += forecast.ghi;
      hourlyTotals[hour].count += 1;
    }
  });
  
  // Calculate averages
  const result: HourlyIrradianceData[] = [];
  for (let h = 0; h < 24; h++) {
    const data = hourlyTotals[h];
    result.push({
      hour: h,
      ghi: data.count > 0 ? data.sum / data.count : 0
    });
  }
  
  return result;
}

export function PVSystemConfig({ config, onChange, maxSolarKva, solarCapacity }: PVSystemConfigProps) {
  const [showLosses, setShowLosses] = useState(false);
  const location = SA_SOLAR_LOCATIONS[config.location];

  const updateConfig = (updates: Partial<PVSystemConfigData>) => {
    const newConfig = { ...config, ...updates };
    if (updates.losses) {
      newConfig.totalLossPercent = calculateTotalLoss(updates.losses);
    }
    onChange(newConfig);
  };

  const updateLoss = (key: keyof SystemLosses, value: number) => {
    const newLosses = { ...config.losses, [key]: value };
    updateConfig({ losses: newLosses, totalLossPercent: calculateTotalLoss(newLosses) });
  };

  const resetLosses = () => {
    updateConfig({ losses: { ...DEFAULT_LOSSES }, totalLossPercent: calculateTotalLoss(DEFAULT_LOSSES) });
  };

  const setOptimalTilt = () => {
    updateConfig({ tilt: Math.round(Math.abs(location.lat)) });
  };

  const efficiency = calculateSystemEfficiency(config);
  const expectedDailyOutput = solarCapacity * location.ghi * efficiency * 0.9;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          PV System Configuration
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {(efficiency * 100).toFixed(1)}% system efficiency
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Configure detailed system parameters (PVWatts-style)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Selection */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Label>
            <Select
              value={config.location}
              onValueChange={(v: LocationKey) => {
                const loc = SA_SOLAR_LOCATIONS[v];
                updateConfig({ 
                  location: v, 
                  tilt: loc.optimalTilt 
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SA_SOLAR_LOCATIONS).map(([key, loc]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{loc.name}</span>
                      <span className="text-muted-foreground">{loc.ghi} kWh/m²/day</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>GHI: {location.ghi} kWh/m²/day</span>
              <span>•</span>
              <span>DNI: {location.dni} kWh/m²/day</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Module Type</Label>
            <Select
              value={config.moduleType}
              onValueChange={(v: ModuleType) => updateConfig({ moduleType: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODULE_TYPES).map(([key, mod]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <div className="flex flex-col">
                      <span>{mod.name}</span>
                      <span className="text-[10px] text-muted-foreground">{mod.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Array Type */}
        <div className="space-y-2">
          <Label className="text-xs">Array Type</Label>
          <Select
            value={config.arrayType}
            onValueChange={(v: ArrayType) => updateConfig({ arrayType: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ARRAY_TYPES).map(([key, arr]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span>{arr.name}</span>
                    {arr.modifier !== 1.0 && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {arr.modifier > 1 ? "+" : ""}{((arr.modifier - 1) * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tilt & Azimuth */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Compass className="h-3 w-3" />
                Tilt Angle
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{config.tilt}°</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={setOptimalTilt}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Set optimal tilt ({Math.round(Math.abs(location.lat))}° for this location)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <Slider
              value={[config.tilt]}
              onValueChange={([v]) => updateConfig({ tilt: v })}
              min={0}
              max={90}
              step={1}
              disabled={config.arrayType.includes("tracking")}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Horizontal</span>
              <span className="text-primary">Optimal: {Math.round(Math.abs(location.lat))}°</span>
              <span>Vertical</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Azimuth</Label>
              <span className="text-xs text-muted-foreground">
                {config.azimuth === 0 ? "N" : config.azimuth > 0 ? `${config.azimuth}° E` : `${Math.abs(config.azimuth)}° W`}
              </span>
            </div>
            <Slider
              value={[config.azimuth]}
              onValueChange={([v]) => updateConfig({ azimuth: v })}
              min={-90}
              max={90}
              step={5}
              disabled={config.arrayType === "tracking_2axis"}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>West</span>
              <span className="text-primary">North (optimal)</span>
              <span>East</span>
            </div>
          </div>
        </div>

        {/* DC/AC Ratio and Inverter Efficiency */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                DC/AC Ratio
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-xs">Ratio of DC array size to AC inverter size. &gt;1.0 means over-paneling.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <span className="text-xs text-muted-foreground">{config.dcAcRatio.toFixed(2)}</span>
            </div>
            <Slider
              value={[config.dcAcRatio * 100]}
              onValueChange={([v]) => updateConfig({ dcAcRatio: v / 100 })}
              min={100}
              max={150}
              step={5}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1:1</span>
              <span>1.5:1</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Inverter Efficiency</Label>
              <span className="text-xs text-muted-foreground">{config.inverterEfficiency}%</span>
            </div>
            <Slider
              value={[config.inverterEfficiency]}
              onValueChange={([v]) => updateConfig({ inverterEfficiency: v })}
              min={90}
              max={99}
              step={0.5}
            />
          </div>
        </div>

        {/* System Losses Collapsible */}
        <Collapsible open={showLosses} onOpenChange={setShowLosses}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                System Losses Calculator
                <Badge variant="secondary" className="text-[10px]">
                  {config.totalLossPercent.toFixed(1)}%
                </Badge>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showLosses ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetLosses} className="text-xs h-7">
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Defaults
              </Button>
            </div>
            
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(config.losses).map(([key, value]) => (
                <LossSlider
                  key={key}
                  label={formatLossLabel(key as keyof SystemLosses)}
                  value={value}
                  onChange={(v) => updateLoss(key as keyof SystemLosses, v)}
                  tooltip={getLossTooltip(key as keyof SystemLosses)}
                />
              ))}
            </div>

            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-xs font-medium">Total System Losses</span>
              <span className={`text-sm font-semibold ${config.totalLossPercent > 20 ? "text-amber-500" : ""}`}>
                {config.totalLossPercent.toFixed(1)}%
              </span>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Expected Output Summary */}
        <div className="pt-3 border-t space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Expected Daily Output</span>
            <span className="font-medium">{expectedDailyOutput.toFixed(1)} kWh</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Annual Generation Estimate</span>
            <span className="font-medium">{(expectedDailyOutput * 365).toFixed(0).toLocaleString()} kWh</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Specific Yield</span>
            <span className="font-medium">{((expectedDailyOutput * 365) / solarCapacity).toFixed(0)} kWh/kWp/year</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LossSlider({ 
  label, 
  value, 
  onChange, 
  tooltip 
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  tooltip: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] flex items-center gap-1">
          {label}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-2.5 w-2.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <span className="text-[10px] text-muted-foreground">{value.toFixed(1)}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={20}
        step={0.5}
        className="h-3"
      />
    </div>
  );
}

function formatLossLabel(key: keyof SystemLosses): string {
  const labels: Record<keyof SystemLosses, string> = {
    soiling: "Soiling",
    shading: "Shading",
    snow: "Snow",
    mismatch: "Mismatch",
    wiring: "Wiring",
    connections: "Connections",
    lightInducedDegradation: "Light-Induced Degradation",
    nameplateRating: "Nameplate Rating",
    age: "Age",
    availability: "Availability",
  };
  return labels[key];
}

function getLossTooltip(key: keyof SystemLosses): string {
  const tooltips: Record<keyof SystemLosses, string> = {
    soiling: "Losses due to dirt, dust, and debris on module surface. Higher in dusty/polluted areas.",
    shading: "Reduction from shadows cast by nearby objects, trees, or self-shading from adjacent rows.",
    snow: "Annual output reduction from snow covering the array. Zero for most SA locations.",
    mismatch: "Electrical losses from slight manufacturing differences between modules.",
    wiring: "Resistive losses in DC and AC wiring connecting modules and inverters.",
    connections: "Resistive losses in electrical connectors throughout the system.",
    lightInducedDegradation: "Initial power reduction in first months of operation (LID).",
    nameplateRating: "Difference between manufacturer rating and actual field performance.",
    age: "Degradation of module output over time (typically 0.5%/year after first year).",
    availability: "System downtime for maintenance, grid outages, and other factors.",
  };
  return tooltips[key];
}
