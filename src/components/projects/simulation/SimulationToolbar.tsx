import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Sun, Zap, Cloud, Loader2, Database, Activity, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SolarDataSource } from "./useSolarProfiles";
import type { LossCalculationMode } from "@/lib/pvsystLossChain";

interface SimulationToolbarProps {
  selectedLocationName: string;
  activeDataSourceLabel: string;
  hasRealData: boolean;
  locationGhi: number;
  solarDataSource: SolarDataSource;
  onSolarDataSourceChange: (v: SolarDataSource) => void;
  solcastLoading: boolean;
  pvgisLoadingMonthly: boolean;
  pvgisLoadingTMY: boolean;
  lossCalculationMode: LossCalculationMode;
  onLossCalculationModeChange: (v: LossCalculationMode) => void;
  isAutoSaving: boolean;
  lastSavedAt: Date | null;
}

export function SimulationToolbar({
  selectedLocationName, activeDataSourceLabel, hasRealData, locationGhi,
  solarDataSource, onSolarDataSourceChange, solcastLoading, pvgisLoadingMonthly, pvgisLoadingTMY,
  lossCalculationMode, onLossCalculationModeChange,
  isAutoSaving, lastSavedAt,
}: SimulationToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Energy Simulation</h2>
          <p className="text-sm text-muted-foreground">
            Model solar and battery energy flows • {selectedLocationName}
            {hasRealData ? (
              <span className="text-primary"> ({activeDataSourceLabel})</span>
            ) : (
              <span> ({locationGhi} kWh/m²/day)</span>
            )}
          </p>
        </div>
        {isAutoSaving ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </div>
        ) : lastSavedAt ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
            <Save className="h-3 w-3" />
            <span>Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={solarDataSource}
          onValueChange={(value) => value && onSolarDataSourceChange(value as SolarDataSource)}
          className="border rounded-lg p-0.5"
        >
          <ToggleGroupItem value="solcast" size="sm" className="text-xs gap-1 px-3" disabled={solcastLoading}>
            {solcastLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
            Solcast
          </ToggleGroupItem>
          <ToggleGroupItem value="pvgis_monthly" size="sm" className="text-xs gap-1 px-3" disabled={pvgisLoadingMonthly}>
            {pvgisLoadingMonthly ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            PVGIS
          </ToggleGroupItem>
          <ToggleGroupItem value="pvgis_tmy" size="sm" className="text-xs gap-1 px-3" disabled={pvgisLoadingTMY}>
            {pvgisLoadingTMY ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            TMY
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          type="single"
          value={lossCalculationMode}
          onValueChange={(value) => value && onLossCalculationModeChange(value as LossCalculationMode)}
          className="border rounded-lg p-0.5"
        >
          <ToggleGroupItem value="simplified" size="sm" className="text-xs gap-1 px-3">
            <Zap className="h-3 w-3" />
            Simplified
          </ToggleGroupItem>
          <ToggleGroupItem value="pvsyst" size="sm" className="text-xs gap-1 px-3">
            <Activity className="h-3 w-3" />
            PVsyst
          </ToggleGroupItem>
        </ToggleGroup>

        {hasRealData && (
          <Badge variant="outline" className="text-xs">
            {solarDataSource === "solcast" ? "Forecast" : solarDataSource === "pvgis_tmy" ? "Typical Year" : "19-Yr Avg"}
          </Badge>
        )}
      </div>
    </div>
  );
}
