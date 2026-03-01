import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/ui/numeric-input";
import type { LoadGrowthConfig } from "../AdvancedSimulationTypes";

export function LoadGrowthSection({
  config,
  onChange,
}: {
  config: LoadGrowthConfig;
  onChange: (config: LoadGrowthConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Annual Growth Rate (%)</Label>
        <div className="flex items-center gap-2">
          <Slider value={[config.annualGrowthRate * 10]} onValueChange={([v]) => onChange({ ...config, annualGrowthRate: v / 10 })} min={0} max={100} step={5} className="flex-1" />
          <span className="text-xs w-12 text-right">{config.annualGrowthRate.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">New Tenant Projection</Label>
        <Switch checked={config.newTenantEnabled} onCheckedChange={(newTenantEnabled) => onChange({ ...config, newTenantEnabled })} />
      </div>
      {config.newTenantEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Year Joining</Label>
            <NumericInput value={config.newTenantYear} onChange={(v) => onChange({ ...config, newTenantYear: v })} fallback={1} integer min={1} max={25} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monthly Load (kWh)</Label>
            <NumericInput value={config.newTenantLoadKwh} onChange={(v) => onChange({ ...config, newTenantLoadKwh: v })} min={0} step={500} className="h-8 text-xs" />
          </div>
        </div>
      )}
    </div>
  );
}
