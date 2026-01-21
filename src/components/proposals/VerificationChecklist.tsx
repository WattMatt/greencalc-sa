import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, MapPin, BarChart3, DollarSign, Settings, Sparkles } from "lucide-react";
import type { VerificationChecklist as VerificationChecklistType } from "./types";

interface ProjectData {
  latitude?: number | null;
  longitude?: number | null;
  tariff_id?: string | null;
}

interface TenantData {
  scada_import_id?: string | null;
  scada_imports?: { raw_data?: any } | null;
}

interface VerificationChecklistProps {
  checklist: VerificationChecklistType;
  onChange: (checklist: VerificationChecklistType) => void;
  disabled?: boolean;
  project?: ProjectData | null;
  tenants?: TenantData[];
  simulationData?: { solarCapacity?: number; batteryCapacity?: number } | null;
}

export function VerificationChecklist({ 
  checklist, 
  onChange, 
  disabled, 
  project,
  tenants,
  simulationData
}: VerificationChecklistProps) {
  // Derived states from project data
  const hasCoordinates = !!(project?.latitude && project?.longitude);
  const hasTariff = !!project?.tariff_id;
  const hasActualMeterData = tenants?.some(t => t.scada_import_id || t.scada_imports?.raw_data);
  const hasSystemSpecs = !!(simulationData?.solarCapacity && simulationData.solarCapacity > 0);

  // Auto-populate on mount and when data changes
  useEffect(() => {
    const updates: Partial<VerificationChecklistType> = {};
    let needsUpdate = false;

    // Auto-check coordinates if they exist
    if (hasCoordinates && !checklist.site_coordinates_verified) {
      updates.site_coordinates_verified = true;
      needsUpdate = true;
    }

    // Auto-set consumption data source based on meter data
    if (checklist.consumption_data_source === null) {
      updates.consumption_data_source = hasActualMeterData ? 'actual' : 'estimated';
      needsUpdate = true;
    }

    // Auto-check tariff if one is assigned
    if (hasTariff && !checklist.tariff_rates_confirmed) {
      updates.tariff_rates_confirmed = true;
      needsUpdate = true;
    }

    // Auto-check system specs if simulation has data
    if (hasSystemSpecs && !checklist.system_specs_validated) {
      updates.system_specs_validated = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      onChange({ ...checklist, ...updates });
    }
  }, [hasCoordinates, hasTariff, hasActualMeterData, hasSystemSpecs]);

  const isComplete = 
    checklist.site_coordinates_verified &&
    checklist.consumption_data_source !== null &&
    checklist.tariff_rates_confirmed &&
    checklist.system_specs_validated;

  const completedCount = [
    checklist.site_coordinates_verified,
    checklist.consumption_data_source !== null,
    checklist.tariff_rates_confirmed,
    checklist.system_specs_validated,
  ].filter(Boolean).length;

  const AutoBadge = () => (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary bg-primary/5">
      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
      Auto
    </Badge>
  );

  return (
    <Card className={isComplete ? "border-green-500/50" : "border-amber-500/50"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            )}
            <CardTitle className="text-base">Data Verification</CardTitle>
          </div>
          <Badge variant="outline" className={isComplete ? "border-green-500/50 text-green-700" : ""}>
            {completedCount}/4 Complete
          </Badge>
        </div>
        <CardDescription>
          Items are auto-verified from project data. Override if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Site Coordinates */}
        <div className={`flex items-start gap-3 p-3 rounded-lg ${hasCoordinates ? 'bg-green-500/5 border border-green-500/20' : 'bg-muted/50'}`}>
          <Checkbox
            id="coordinates"
            checked={checklist.site_coordinates_verified}
            onCheckedChange={(checked) =>
              onChange({ ...checklist, site_coordinates_verified: checked === true })
            }
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor="coordinates" className="flex items-center gap-2 cursor-pointer">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Site Coordinates
              {hasCoordinates && <AutoBadge />}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasCoordinates 
                ? `Found: ${project?.latitude?.toFixed(4)}, ${project?.longitude?.toFixed(4)}`
                : 'No coordinates set on project'
              }
            </p>
          </div>
        </div>

        {/* Consumption Data Source */}
        <div className={`p-3 rounded-lg space-y-2 ${hasActualMeterData ? 'bg-green-500/5 border border-green-500/20' : 'bg-muted/50'}`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <Label>Consumption Data</Label>
            {checklist.consumption_data_source && <AutoBadge />}
          </div>
          <RadioGroup
            value={checklist.consumption_data_source || ""}
            onValueChange={(value) =>
              onChange({ ...checklist, consumption_data_source: value as 'actual' | 'estimated' })
            }
            disabled={disabled}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="actual" id="actual" />
              <Label htmlFor="actual" className="cursor-pointer font-normal text-sm">
                Actual meter data
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="estimated" id="estimated" />
              <Label htmlFor="estimated" className="cursor-pointer font-normal text-sm">
                Estimated profiles
              </Label>
            </div>
          </RadioGroup>
          {checklist.consumption_data_source === 'estimated' && (
            <p className="text-xs text-amber-600">
              ⚠️ Disclaimer will note estimated consumption
            </p>
          )}
        </div>

        {/* Tariff Rates */}
        <div className={`flex items-start gap-3 p-3 rounded-lg ${hasTariff ? 'bg-green-500/5 border border-green-500/20' : 'bg-muted/50'}`}>
          <Checkbox
            id="tariff"
            checked={checklist.tariff_rates_confirmed}
            onCheckedChange={(checked) =>
              onChange({ ...checklist, tariff_rates_confirmed: checked === true })
            }
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor="tariff" className="flex items-center gap-2 cursor-pointer">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Tariff Rates
              {hasTariff && <AutoBadge />}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasTariff 
                ? 'Tariff assigned to project'
                : 'No tariff linked - rates may be inaccurate'
              }
            </p>
          </div>
        </div>

        {/* System Specs */}
        <div className={`flex items-start gap-3 p-3 rounded-lg ${hasSystemSpecs ? 'bg-green-500/5 border border-green-500/20' : 'bg-muted/50'}`}>
          <Checkbox
            id="specs"
            checked={checklist.system_specs_validated}
            onCheckedChange={(checked) =>
              onChange({ ...checklist, system_specs_validated: checked === true })
            }
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor="specs" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4 text-muted-foreground" />
              System Specifications
              {hasSystemSpecs && <AutoBadge />}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasSystemSpecs 
                ? `${simulationData?.solarCapacity} kWp solar${simulationData?.batteryCapacity ? `, ${simulationData.batteryCapacity} kWh battery` : ''}`
                : 'No simulation data available'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
