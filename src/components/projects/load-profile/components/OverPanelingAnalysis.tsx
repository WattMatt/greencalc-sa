import { Sun } from "lucide-react";
import { OverPanelingStats } from "../types";

interface OverPanelingAnalysisProps {
  stats: OverPanelingStats;
  dcAcRatio: number;
}

export function OverPanelingAnalysis({ stats, dcAcRatio }: OverPanelingAnalysisProps) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1.5">
        <Sun className="h-3 w-3" />
        DC/AC Oversizing Analysis ({(dcAcRatio * 100).toFixed(0)}% ratio)
      </p>

      {/* Daily Stats */}
      <div className="grid grid-cols-4 gap-3 text-xs mb-3">
        <div>
          <p className="text-muted-foreground">Daily 1:1 Baseline</p>
          <p className="font-semibold">{stats.total1to1Baseline.toFixed(1)} kWh</p>
        </div>
        <div>
          <p className="text-muted-foreground">Daily With Oversizing</p>
          <p className="font-semibold">{stats.totalAcOutput.toFixed(1)} kWh</p>
        </div>
        <div>
          <p className="text-muted-foreground">Daily Additional</p>
          <p className={`font-semibold ${stats.additionalKwh >= 0 ? "text-green-600" : "text-red-500"}`}>
            +{stats.additionalKwh.toFixed(1)} kWh
            <span className="text-[10px] ml-1">
              ({stats.percentGain >= 0 ? "+" : ""}
              {stats.percentGain.toFixed(1)}%)
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Daily Clipping</p>
          <p className="font-semibold text-orange-500">
            {stats.totalClipping.toFixed(1)} kWh
            <span className="text-[10px] ml-1">({stats.clippingPercent.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* Monthly & Annual Projections */}
      <div className="pt-2 border-t border-amber-500/20">
        <p className="text-[10px] text-muted-foreground mb-1.5">Projected Gains</p>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-green-500/10">
            <div>
              <p className="text-muted-foreground text-[10px]">Monthly Additional</p>
              <p className="font-semibold text-green-600">+{(stats.monthlyAdditionalKwh / 1000).toFixed(1)} MWh</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[10px]">Annual Additional</p>
              <p className="font-bold text-green-600">+{(stats.annualAdditionalKwh / 1000).toFixed(1)} MWh</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-orange-500/10">
            <div>
              <p className="text-muted-foreground text-[10px]">Monthly Clipping</p>
              <p className="font-semibold text-orange-500">{(stats.monthlyClipping / 1000).toFixed(1)} MWh</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[10px]">Annual Clipping</p>
              <p className="font-bold text-orange-500">{(stats.annualClipping / 1000).toFixed(1)} MWh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
