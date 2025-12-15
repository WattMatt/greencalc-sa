import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Info, ChevronDown, MapPin, Zap, Sun, Battery } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { AccuracyBadge } from "./AccuracyBadge";

const SA_CITIES = [
  { name: "Johannesburg", lat: -26.2041, lng: 28.0473, psh: 5.5 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, psh: 5.8 },
  { name: "Durban", lat: -29.8587, lng: 31.0218, psh: 5.2 },
  { name: "Pretoria", lat: -25.7479, lng: 28.2293, psh: 5.6 },
  { name: "Port Elizabeth", lat: -33.918861, lng: 25.570737, psh: 5.4 },
  { name: "Bloemfontein", lat: -29.0852, lng: 26.1596, psh: 5.7 },
  { name: "Polokwane", lat: -23.9045, lng: 29.4688, psh: 5.8 },
  { name: "Nelspruit", lat: -25.4753, lng: 30.9694, psh: 5.3 },
  { name: "Kimberley", lat: -28.7282, lng: 24.7499, psh: 6.0 },
  { name: "Upington", lat: -28.4478, lng: 21.2561, psh: 6.3 },
];

export interface QuickEstimateInputs {
  location: string;
  latitude: number;
  longitude: number;
  peakSunHours: number;
  siteArea: number;
  monthlyConsumption: number;
  solarCapacity: number;
  batteryCapacity: number;
  useSolcast: boolean;
  systemLosses: number;
  tariffRate: number;
  tariffEscalation: number;
}

interface QuickEstimateFormProps {
  inputs: QuickEstimateInputs;
  onInputChange: (inputs: QuickEstimateInputs) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function QuickEstimateForm({ inputs, onInputChange, onCalculate, isCalculating }: QuickEstimateFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLocationChange = (cityName: string) => {
    const city = SA_CITIES.find(c => c.name === cityName);
    if (city) {
      onInputChange({
        ...inputs,
        location: city.name,
        latitude: city.lat,
        longitude: city.lng,
        peakSunHours: city.psh,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-primary" />
          System Parameters
        </CardTitle>
        <CardDescription>
          Enter basic site details for a quick estimate. All values use sensible defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location */}
        <div className="space-y-2" data-tour="location-select">
          <div className="flex items-center gap-2">
            <Label htmlFor="location">Location</Label>
            <InfoTooltip content="Select the nearest city to your site. This determines solar irradiance levels used in calculations." />
          </div>
          <Select value={inputs.location} onValueChange={handleLocationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a city">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {inputs.location || "Select a city"}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SA_CITIES.map((city) => (
                <SelectItem key={city.name} value={city.name}>
                  {city.name} ({city.psh} PSH)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inputs.location && (
            <p className="text-xs text-muted-foreground">
              Peak Sun Hours: {inputs.peakSunHours} hours/day
            </p>
          )}
        </div>

        {/* Site Area */}
        <div className="space-y-2" data-tour="site-area">
          <div className="flex items-center gap-2">
            <Label htmlFor="siteArea">Site Area (m²)</Label>
            <InfoTooltip content="Total floor area of the facility. Used to estimate consumption if not specified." />
          </div>
          <Input
            id="siteArea"
            type="number"
            value={inputs.siteArea}
            onChange={(e) => onInputChange({ ...inputs, siteArea: Number(e.target.value) })}
            placeholder="e.g., 5000"
          />
        </div>

        {/* Monthly Consumption */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="consumption">Monthly Consumption (kWh)</Label>
              <InfoTooltip content="Average monthly electricity consumption. If unknown, we estimate 50 kWh/m²/month for commercial buildings." />
            </div>
            <AccuracyBadge 
              level="estimated" 
              label="Manual Input"
              showIcon={true}
            />
          </div>
          <Input
            id="consumption"
            type="number"
            value={inputs.monthlyConsumption}
            onChange={(e) => onInputChange({ ...inputs, monthlyConsumption: Number(e.target.value) })}
            placeholder="e.g., 250000"
          />
          <p className="text-xs text-muted-foreground">
            For actual data accuracy, use Profile Builder mode with SCADA meters
          </p>
        </div>

        {/* Solar Capacity */}
        <div className="space-y-3" data-tour="solar-capacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Solar PV Capacity</Label>
              <InfoTooltip content="The peak DC capacity of the solar array. Higher capacity means more generation but higher upfront cost." />
            </div>
            <span className="text-sm font-medium">{inputs.solarCapacity} kWp</span>
          </div>
          <Slider
            value={[inputs.solarCapacity]}
            onValueChange={([value]) => onInputChange({ ...inputs, solarCapacity: value })}
            min={10}
            max={2000}
            step={10}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10 kWp</span>
            <span>2,000 kWp</span>
          </div>
        </div>

        {/* Battery Capacity */}
        <div className="space-y-3" data-tour="battery-capacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Battery Storage</Label>
              <InfoTooltip content="Optional battery storage for peak shaving and backup. Set to 0 for solar-only analysis." />
            </div>
            <span className="text-sm font-medium">{inputs.batteryCapacity} kWh</span>
          </div>
          <Slider
            value={[inputs.batteryCapacity]}
            onValueChange={([value]) => onInputChange({ ...inputs, batteryCapacity: value })}
            min={0}
            max={1000}
            step={10}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>No Battery</span>
            <span>1,000 kWh</span>
          </div>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              Advanced Settings
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Solcast Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="solcast">Use Solcast Irradiance</Label>
                <InfoTooltip content="Fetch real-time solar irradiance data from Solcast API for more accurate generation estimates." />
              </div>
              <Switch
                id="solcast"
                checked={inputs.useSolcast}
                onCheckedChange={(checked) => onInputChange({ ...inputs, useSolcast: checked })}
              />
            </div>

            {/* System Losses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>System Losses</Label>
                  <InfoTooltip content="Total system losses including soiling, wiring, inverter efficiency, and temperature derating." />
                </div>
                <span className="text-sm">{inputs.systemLosses}%</span>
              </div>
              <Slider
                value={[inputs.systemLosses]}
                onValueChange={([value]) => onInputChange({ ...inputs, systemLosses: value })}
                min={5}
                max={25}
                step={1}
              />
            </div>

            {/* Tariff Rate */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="tariff">Avg. Tariff Rate (R/kWh)</Label>
                <InfoTooltip content="Blended average electricity rate. For TOU tariffs, use a weighted average of peak/standard/off-peak rates." />
              </div>
              <Input
                id="tariff"
                type="number"
                step="0.01"
                value={inputs.tariffRate}
                onChange={(e) => onInputChange({ ...inputs, tariffRate: Number(e.target.value) })}
              />
            </div>

            {/* Tariff Escalation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="escalation">Annual Tariff Escalation (%)</Label>
                <InfoTooltip content="Expected annual increase in electricity tariffs. NERSA has historically approved 8-15% annual increases." />
              </div>
              <Input
                id="escalation"
                type="number"
                step="0.5"
                value={inputs.tariffEscalation}
                onChange={(e) => onInputChange({ ...inputs, tariffEscalation: Number(e.target.value) })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button 
          onClick={onCalculate} 
          className="w-full" 
          size="lg" 
          disabled={isCalculating || !inputs.location}
          data-tour="calculate-btn"
        >
          {isCalculating ? (
            <>Calculating...</>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Calculate Estimate
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
