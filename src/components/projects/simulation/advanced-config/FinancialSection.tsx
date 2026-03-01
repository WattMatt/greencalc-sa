import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/ui/numeric-input";
import type { AdvancedFinancialConfig } from "../AdvancedSimulationTypes";

export function FinancialSection({
  config,
  onChange,
}: {
  config: AdvancedFinancialConfig;
  onChange: (config: AdvancedFinancialConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tariff Escalation (%/yr)</Label>
          <NumericInput value={config.tariffEscalationRate} onChange={(v) => onChange({ ...config, tariffEscalationRate: v })} min={0} max={25} step={0.5} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Inflation Rate (%)</Label>
          <NumericInput value={config.inflationRate} onChange={(v) => onChange({ ...config, inflationRate: v })} min={0} max={15} step={0.5} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discount Rate (%)</Label>
          <NumericInput value={config.discountRate} onChange={(v) => onChange({ ...config, discountRate: v })} min={0} max={20} step={0.5} className="h-8 text-xs" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Project Lifetime (years)</Label>
          <NumericInput value={config.projectLifetimeYears} onChange={(v) => onChange({ ...config, projectLifetimeYears: v })} fallback={25} integer min={10} max={30} className="h-8 text-xs" />
        </div>
        <div className="flex items-center justify-between pt-4">
          <Label className="text-xs">Sensitivity Analysis</Label>
          <Switch checked={config.sensitivityEnabled} onCheckedChange={(sensitivityEnabled) => onChange({ ...config, sensitivityEnabled })} />
        </div>
      </div>
      {config.sensitivityEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Variation Range (%)</Label>
          <div className="flex items-center gap-2">
            <Slider value={[config.sensitivityVariation]} onValueChange={([v]) => onChange({ ...config, sensitivityVariation: v })} min={5} max={40} step={5} className="flex-1" />
            <span className="text-xs w-12 text-right">±{config.sensitivityVariation}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
