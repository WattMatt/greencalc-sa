import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/ui/numeric-input";
import type { GridConstraintsConfig } from "../AdvancedSimulationTypes";

export function GridConstraintsSection({
  config,
  onChange,
}: {
  config: GridConstraintsConfig;
  onChange: (config: GridConstraintsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Export Limit</Label>
        <Switch checked={config.exportLimitEnabled} onCheckedChange={(exportLimitEnabled) => onChange({ ...config, exportLimitEnabled })} />
      </div>
      {config.exportLimitEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Max Export (kW)</Label>
          <NumericInput value={config.maxExportKw} onChange={(v) => onChange({ ...config, maxExportKw: v })} min={0} step={10} className="h-8 text-xs" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Wheeling Charges</Label>
        <Switch checked={config.wheelingEnabled} onCheckedChange={(wheelingEnabled) => onChange({ ...config, wheelingEnabled })} />
      </div>
      {config.wheelingEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Wheeling Charge (R/kWh)</Label>
          <NumericInput value={config.wheelingChargePerKwh} onChange={(v) => onChange({ ...config, wheelingChargePerKwh: v })} min={0} step={0.05} className="h-8 text-xs" />
        </div>
      )}
    </div>
  );
}
