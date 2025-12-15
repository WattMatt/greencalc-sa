import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, MapPin, BarChart3, DollarSign, Settings } from "lucide-react";
import type { VerificationChecklist as VerificationChecklistType } from "./types";

interface VerificationChecklistProps {
  checklist: VerificationChecklistType;
  onChange: (checklist: VerificationChecklistType) => void;
  disabled?: boolean;
}

export function VerificationChecklist({ checklist, onChange, disabled }: VerificationChecklistProps) {
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
            <CardTitle className="text-base">Verification Checklist</CardTitle>
          </div>
          <Badge variant="outline" className={isComplete ? "border-green-500/50 text-green-700" : ""}>
            {completedCount}/4 Complete
          </Badge>
        </div>
        <CardDescription>
          Confirm all data sources before generating the proposal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Site Coordinates */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
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
              Site Coordinates Verified
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Confirm GPS coordinates match the actual installation site
            </p>
          </div>
        </div>

        {/* Consumption Data Source */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <Label>Consumption Data Source</Label>
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
              <Label htmlFor="actual" className="cursor-pointer font-normal">
                Actual meter data
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="estimated" id="estimated" />
              <Label htmlFor="estimated" className="cursor-pointer font-normal">
                Estimated from profiles
              </Label>
            </div>
          </RadioGroup>
          {checklist.consumption_data_source === 'estimated' && (
            <p className="text-xs text-amber-600">
              ⚠️ Proposal will include disclaimer about estimated consumption
            </p>
          )}
        </div>

        {/* Tariff Rates */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
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
              Tariff Rates Confirmed Current
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Verify tariff rates are from the current financial year
            </p>
          </div>
        </div>

        {/* System Specs */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
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
              System Specifications Validated
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Confirm panel wattage, inverter sizing, and battery specs are accurate
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
