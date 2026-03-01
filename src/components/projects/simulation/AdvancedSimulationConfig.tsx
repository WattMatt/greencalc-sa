import React, { useState } from "react";
import { ChevronDown, ChevronUp, Settings2, Sparkles, Save, Trash2, User, Sun, Battery, TrendingUp, Zap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BatteryDispatchStrategy, DispatchConfig, TimeWindow, DischargeSource } from "./EnergySimulationEngine";
import { DEFAULT_DISCHARGE_SOURCES } from "./EnergySimulationEngine";
import { DischargeTOUSelection } from "@/components/projects/load-profile/types";
import {
  AdvancedSimulationConfig,
  DEFAULT_ADVANCED_CONFIG,
  SIMULATION_PRESETS,
  PresetName,
} from "./AdvancedSimulationTypes";
import { useSimulationPresets, SimulationPreset } from "@/hooks/useSimulationPresets";

import {
  CollapsibleSection,
  SeasonalSection,
  DegradationSection,
  FinancialSection,
  GridConstraintsSection,
  LoadGrowthSection,
  SolarCharacteristicsSection,
  BatteryCharacteristicsSection,
} from "./advanced-config";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

interface AdvancedSimulationConfigProps {
  config: AdvancedSimulationConfig;
  onChange: (config: AdvancedSimulationConfig) => void;
  includesBattery?: boolean;
  batteryChargeCRate?: number;
  onBatteryChargeCRateChange?: (value: number) => void;
  batteryDischargeCRate?: number;
  onBatteryDischargeCRateChange?: (value: number) => void;
  batteryDoD?: number;
  batteryMinSoC?: number;
  onBatteryMinSoCChange?: (value: number) => void;
  batteryMaxSoC?: number;
  onBatteryMaxSoCChange?: (value: number) => void;
  batteryStrategy?: BatteryDispatchStrategy;
  onBatteryStrategyChange?: (strategy: BatteryDispatchStrategy) => void;
  dispatchConfig?: DispatchConfig;
  onDispatchConfigChange?: (config: DispatchConfig) => void;
  chargeTouPeriod?: TOUPeriod;
  onChargeTouPeriodChange?: (period: TOUPeriod) => void;
  dischargeTouSelection?: DischargeTOUSelection;
  onDischargeTouSelectionChange?: (selection: DischargeTOUSelection) => void;
  touPeriodToWindows?: (period: TOUPeriod) => TimeWindow[];
  dischargeSources?: DischargeSource[];
  onDischargeSourcesChange?: (sources: DischargeSource[]) => void;
}

export function AdvancedSimulationConfigPanel({
  config, onChange, includesBattery = false,
  batteryChargeCRate, onBatteryChargeCRateChange,
  batteryDischargeCRate, onBatteryDischargeCRateChange,
  batteryDoD, batteryMinSoC, onBatteryMinSoCChange,
  batteryMaxSoC, onBatteryMaxSoCChange,
  batteryStrategy, onBatteryStrategyChange,
  dispatchConfig, onDispatchConfigChange,
  chargeTouPeriod, onChargeTouPeriodChange,
  dischargeTouSelection, onDischargeTouSelectionChange,
  touPeriodToWindows, dischargeSources, onDischargeSourcesChange,
}: AdvancedSimulationConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const { presets, isLoading, createPreset, deletePreset } = useSimulationPresets();

  const enabledCount = [
    config.seasonal.enabled, config.degradation.enabled,
    config.financial.enabled, config.gridConstraints.enabled, config.loadGrowth.enabled,
  ].filter(Boolean).length;

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    createPreset.mutate({ name: presetName.trim(), description: presetDescription.trim() || undefined, config }, {
      onSuccess: () => { setSaveDialogOpen(false); setPresetName(""); setPresetDescription(""); },
    });
  };

  const handleDeletePreset = (preset: SimulationPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete preset "${preset.name}"?`)) deletePreset.mutate(preset.id);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Advanced Simulation</CardTitle>
                {enabledCount > 0 && <Badge variant="secondary" className="text-xs">{enabledCount} active</Badge>}
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Built-in Presets */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mr-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Quick Presets:</Label>
              </div>
              <TooltipProvider>
                {(Object.keys(SIMULATION_PRESETS) as PresetName[]).map((key) => {
                  const preset = SIMULATION_PRESETS[key];
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onChange(preset.config); }}>
                          {preset.name}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{preset.description}</p></TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground ml-auto" onClick={(e) => { e.stopPropagation(); onChange(DEFAULT_ADVANCED_CONFIG); }}>Reset</Button>
            </div>

            {/* Custom Presets */}
            {(presets.length > 0 || !isLoading) && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mr-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">My Presets:</Label>
                </div>
                <TooltipProvider>
                  {presets.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-7 text-xs gap-1 group" onClick={(e) => { e.stopPropagation(); onChange(preset.config as AdvancedSimulationConfig); }}>
                          {preset.name}
                          <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" onClick={(e) => handleDeletePreset(preset, e)} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{preset.description || "Custom preset"}</p></TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
                {presets.length === 0 && <span className="text-xs text-muted-foreground">No saved presets yet</span>}
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                      <Save className="h-3 w-3" />Save Current
                    </Button>
                  </DialogTrigger>
                  <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>Save Preset</DialogTitle>
                      <DialogDescription>Save your current configuration as a reusable preset.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="preset-name">Preset Name</Label>
                        <Input id="preset-name" placeholder="e.g., High Solar Scenario" value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={50} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preset-description">Description (optional)</Label>
                        <Input id="preset-description" placeholder="Brief description" value={presetDescription} onChange={(e) => setPresetDescription(e.target.value)} maxLength={200} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSavePreset} disabled={!presetName.trim() || createPreset.isPending}>
                        {createPreset.isPending ? "Saving..." : "Save Preset"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Section panels */}
            <CollapsibleSection icon={<Sun className="h-4 w-4 text-amber-500" />} title="Solar Characteristics">
              <SolarCharacteristicsSection dischargeSources={dischargeSources ?? DEFAULT_DISCHARGE_SOURCES} onDischargeSourcesChange={onDischargeSourcesChange} />
            </CollapsibleSection>

            {includesBattery && (
              <CollapsibleSection icon={<Battery className="h-4 w-4 text-primary" />} title="Battery Characteristics">
                <BatteryCharacteristicsSection
                  chargeCRate={batteryChargeCRate!} onChargeCRateChange={onBatteryChargeCRateChange}
                  dischargeCRate={batteryDischargeCRate!} onDischargeCRateChange={onBatteryDischargeCRateChange}
                  doD={batteryDoD!} minSoC={batteryMinSoC!} onMinSoCChange={onBatteryMinSoCChange}
                  maxSoC={batteryMaxSoC!} onMaxSoCChange={onBatteryMaxSoCChange}
                  batteryStrategy={batteryStrategy} onBatteryStrategyChange={onBatteryStrategyChange}
                  dispatchConfig={dispatchConfig} onDispatchConfigChange={onDispatchConfigChange}
                  chargeTouPeriod={chargeTouPeriod} onChargeTouPeriodChange={onChargeTouPeriodChange}
                  dischargeTouSelection={dischargeTouSelection} onDischargeTouSelectionChange={onDischargeTouSelectionChange}
                  touPeriodToWindows={touPeriodToWindows}
                />
              </CollapsibleSection>
            )}

            <CollapsibleSection icon={<Sun className="h-4 w-4 text-amber-500" />} title="Seasonal Variation"
              toggleEnabled={config.seasonal.enabled} onToggleEnabled={(enabled) => onChange({ ...config, seasonal: { ...config.seasonal, enabled } })}>
              {config.seasonal.enabled && <SeasonalSection config={config.seasonal} onChange={(seasonal) => onChange({ ...config, seasonal })} />}
            </CollapsibleSection>

            <CollapsibleSection icon={<Battery className="h-4 w-4 text-primary" />} title="Degradation Modeling"
              toggleEnabled={config.degradation.enabled} onToggleEnabled={(enabled) => onChange({ ...config, degradation: { ...config.degradation, enabled } })}>
              {config.degradation.enabled && <DegradationSection config={config.degradation} onChange={(degradation) => onChange({ ...config, degradation })} projectLifetime={config.financial.projectLifetimeYears || 20} includesBattery={includesBattery} />}
            </CollapsibleSection>

            <CollapsibleSection icon={<TrendingUp className="h-4 w-4 text-primary" />} title="Financial Sophistication"
              toggleEnabled={config.financial.enabled} onToggleEnabled={(enabled) => onChange({ ...config, financial: { ...config.financial, enabled } })}>
              {config.financial.enabled && <FinancialSection config={config.financial} onChange={(financial) => onChange({ ...config, financial })} />}
            </CollapsibleSection>

            <CollapsibleSection icon={<Zap className="h-4 w-4 text-yellow-500" />} title="Grid Constraints"
              toggleEnabled={config.gridConstraints.enabled} onToggleEnabled={(enabled) => onChange({ ...config, gridConstraints: { ...config.gridConstraints, enabled } })}>
              {config.gridConstraints.enabled && <GridConstraintsSection config={config.gridConstraints} onChange={(gridConstraints) => onChange({ ...config, gridConstraints })} />}
            </CollapsibleSection>

            <CollapsibleSection icon={<Building2 className="h-4 w-4 text-purple-500" />} title="Load Growth"
              toggleEnabled={config.loadGrowth.enabled} onToggleEnabled={(enabled) => onChange({ ...config, loadGrowth: { ...config.loadGrowth, enabled } })}>
              {config.loadGrowth.enabled && <LoadGrowthSection config={config.loadGrowth} onChange={(loadGrowth) => onChange({ ...config, loadGrowth })} />}
            </CollapsibleSection>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
