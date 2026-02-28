import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Database, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { SavedSimulations } from "../SavedSimulations";
import { restoreSimulationState, type SimulationStateSetters } from "./restoreSimulationState";

interface SavedConfigCollapsibleProps {
  projectId: string;
  isLoadingLastSaved: boolean;
  loadedSimulationName: string | null;
  loadedSimulationDate: string | null;
  currentConfig: any;
  currentResults: any;
  stateSetters: SimulationStateSetters;
  includesBattery: boolean;
  batteryDoD: number;
}

export function SavedConfigCollapsible({
  projectId, isLoadingLastSaved, loadedSimulationName, loadedSimulationDate,
  currentConfig, currentResults, stateSetters, includesBattery, batteryDoD,
}: SavedConfigCollapsibleProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-auto py-2.5 px-3">
          <div className="flex items-center gap-2 text-sm">
            {isLoadingLastSaved ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading saved configurations...</span>
              </>
            ) : loadedSimulationName ? (
              <>
                <Database className="h-4 w-4 text-primary" />
                <span className="font-medium">{loadedSimulationName}</span>
                {loadedSimulationDate && (
                  <span className="text-muted-foreground">
                    • {format(new Date(loadedSimulationDate), "dd MMM yyyy HH:mm")}
                  </span>
                )}
              </>
            ) : (
              <>
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Saved Configurations</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <SavedSimulations
          projectId={projectId}
          currentConfig={currentConfig}
          currentResults={currentResults}
          onLoadSimulation={(config) => {
            restoreSimulationState({
              solarCapacity: config.solarCapacity,
              batteryCapacityDc: config.batteryCapacity || 0,
              batteryPower: config.batteryPower || 0,
              batteryDoD: config.batteryDoD || batteryDoD || 85,
              batteryMinSoC: config.batteryMinSoC,
              batteryMaxSoC: config.batteryMaxSoC,
              batteryChargeCRate: config.batteryChargeCRate,
              batteryDischargeCRate: config.batteryDischargeCRate,
              batteryCRate: config.batteryCRate,
              batteryStrategy: config.batteryStrategy,
              dispatchConfig: config.dispatchConfig,
              chargeTouPeriod: config.chargeTouPeriod,
              dischargeTouPeriod: config.dischargeTouPeriod,
              dischargeTouSelection: config.dischargeTouSelection,
              pvConfig: config.pvConfig,
              inverterConfig: config.inverterConfig,
              solarDataSource: config.solarDataSource,
              pvsystConfig: config.pvsystConfig,
              lossCalculationMode: config.lossCalculationMode,
              productionReductionPercent: config.productionReductionPercent,
              advancedConfig: config.advancedConfig,
              systemCosts: config.systemCosts,
              simulationName: config.simulationName,
              simulationDate: config.simulationDate,
            }, stateSetters, includesBattery);
          }}
          includesBattery={includesBattery}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
