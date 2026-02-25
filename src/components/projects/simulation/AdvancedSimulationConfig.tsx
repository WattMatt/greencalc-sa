import { useState } from "react";
import { ChevronDown, ChevronUp, Settings2, TrendingUp, Battery, Zap, Building2, Sun, Sparkles, Save, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AdvancedSimulationConfig,
  DEFAULT_ADVANCED_CONFIG,
  SeasonalConfig,
  DegradationConfig,
  AdvancedFinancialConfig,
  GridConstraintsConfig,
  LoadGrowthConfig,
  SIMULATION_PRESETS,
  PresetName,
} from "./AdvancedSimulationTypes";
import { useSimulationPresets, SimulationPreset } from "@/hooks/useSimulationPresets";

interface AdvancedSimulationConfigProps {
  config: AdvancedSimulationConfig;
  onChange: (config: AdvancedSimulationConfig) => void;
  includesBattery?: boolean;
  batteryChargeCRate?: number;
  onBatteryChargeCRateChange?: (value: number) => void;
  batteryDischargeCRate?: number;
  onBatteryDischargeCRateChange?: (value: number) => void;
  batteryDoD?: number;
  onBatteryDoDChange?: (value: number) => void;
  batteryMinSoC?: number;
  onBatteryMinSoCChange?: (value: number) => void;
  batteryMaxSoC?: number;
  onBatteryMaxSoCChange?: (value: number) => void;
}

export function AdvancedSimulationConfigPanel({ 
  config, 
  onChange,
  includesBattery = false,
  batteryChargeCRate = 0.5,
  onBatteryChargeCRateChange,
  batteryDischargeCRate = 0.5,
  onBatteryDischargeCRateChange,
  batteryDoD = 85,
  onBatteryDoDChange,
  batteryMinSoC = 10,
  onBatteryMinSoCChange,
  batteryMaxSoC = 95,
  onBatteryMaxSoCChange,
}: AdvancedSimulationConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  
  const { presets, isLoading, createPreset, deletePreset } = useSimulationPresets();
  
  const enabledCount = [
    config.seasonal.enabled,
    config.degradation.enabled,
    config.financial.enabled,
    config.gridConstraints.enabled,
    config.loadGrowth.enabled,
  ].filter(Boolean).length;

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    
    createPreset.mutate({
      name: presetName.trim(),
      description: presetDescription.trim() || undefined,
      config,
    }, {
      onSuccess: () => {
        setSaveDialogOpen(false);
        setPresetName("");
        setPresetDescription("");
      },
    });
  };

  const handleDeletePreset = (preset: SimulationPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete preset "${preset.name}"?`)) {
      deletePreset.mutate(preset.id);
    }
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
                {enabledCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {enabledCount} active
                  </Badge>
                )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(preset.config);
                          }}
                        >
                          {preset.name}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs">{preset.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground ml-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(DEFAULT_ADVANCED_CONFIG);
                }}
              >
                Reset
              </Button>
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
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1 group"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(preset.config as AdvancedSimulationConfig);
                          }}
                        >
                          {preset.name}
                          <Trash2 
                            className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                            onClick={(e) => handleDeletePreset(preset, e)}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs">{preset.description || "Custom preset"}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>

                {presets.length === 0 && (
                  <span className="text-xs text-muted-foreground">No saved presets yet</span>
                )}
                
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Save className="h-3 w-3" />
                      Save Current
                    </Button>
                  </DialogTrigger>
                  <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>Save Preset</DialogTitle>
                      <DialogDescription>
                        Save your current configuration as a reusable preset.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="preset-name">Preset Name</Label>
                        <Input
                          id="preset-name"
                          placeholder="e.g., High Solar Scenario"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          maxLength={50}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preset-description">Description (optional)</Label>
                        <Input
                          id="preset-description"
                          placeholder="Brief description of this configuration"
                          value={presetDescription}
                          onChange={(e) => setPresetDescription(e.target.value)}
                          maxLength={200}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSavePreset}
                        disabled={!presetName.trim() || createPreset.isPending}
                      >
                        {createPreset.isPending ? "Saving..." : "Save Preset"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Battery Characteristics */}
            {includesBattery && (
              <CollapsibleSection icon={<Battery className="h-4 w-4 text-primary" />} title="Battery Characteristics">
                <BatteryCharacteristicsSection
                  chargeCRate={batteryChargeCRate}
                  onChargeCRateChange={onBatteryChargeCRateChange}
                  dischargeCRate={batteryDischargeCRate}
                  onDischargeCRateChange={onBatteryDischargeCRateChange}
                  doD={batteryDoD}
                  onDoDChange={onBatteryDoDChange}
                  minSoC={batteryMinSoC}
                  onMinSoCChange={onBatteryMinSoCChange}
                  maxSoC={batteryMaxSoC}
                  onMaxSoCChange={onBatteryMaxSoCChange}
                />
              </CollapsibleSection>
            )}

            {/* Seasonal Variation */}
            <CollapsibleSection 
              icon={<Sun className="h-4 w-4 text-amber-500" />} 
              title="Seasonal Variation"
              toggleEnabled={config.seasonal.enabled}
              onToggleEnabled={(enabled) => onChange({ ...config, seasonal: { ...config.seasonal, enabled } })}
            >
              {config.seasonal.enabled && (
                <SeasonalSection 
                  config={config.seasonal}
                  onChange={(seasonal) => onChange({ ...config, seasonal })}
                />
              )}
            </CollapsibleSection>
            
            {/* Degradation Modeling */}
            <CollapsibleSection 
              icon={<Battery className="h-4 w-4 text-primary" />} 
              title="Degradation Modeling"
              toggleEnabled={config.degradation.enabled}
              onToggleEnabled={(enabled) => onChange({ ...config, degradation: { ...config.degradation, enabled } })}
            >
              {config.degradation.enabled && (
                <DegradationSection
                  config={config.degradation}
                  onChange={(degradation) => onChange({ ...config, degradation })}
                  projectLifetime={config.financial.projectLifetimeYears || 20}
                  includesBattery={includesBattery}
                />
              )}
            </CollapsibleSection>
            
            {/* Financial Sophistication */}
            <CollapsibleSection 
              icon={<TrendingUp className="h-4 w-4 text-primary" />} 
              title="Financial Sophistication"
              toggleEnabled={config.financial.enabled}
              onToggleEnabled={(enabled) => onChange({ ...config, financial: { ...config.financial, enabled } })}
            >
              {config.financial.enabled && (
                <FinancialSection
                  config={config.financial}
                  onChange={(financial) => onChange({ ...config, financial })}
                />
              )}
            </CollapsibleSection>
            
            {/* Grid Constraints */}
            <CollapsibleSection 
              icon={<Zap className="h-4 w-4 text-yellow-500" />} 
              title="Grid Constraints"
              toggleEnabled={config.gridConstraints.enabled}
              onToggleEnabled={(enabled) => onChange({ ...config, gridConstraints: { ...config.gridConstraints, enabled } })}
            >
              {config.gridConstraints.enabled && (
                <GridConstraintsSection
                  config={config.gridConstraints}
                  onChange={(gridConstraints) => onChange({ ...config, gridConstraints })}
                />
              )}
            </CollapsibleSection>
            
            {/* Load Growth */}
            <CollapsibleSection 
              icon={<Building2 className="h-4 w-4 text-purple-500" />} 
              title="Load Growth"
              toggleEnabled={config.loadGrowth.enabled}
              onToggleEnabled={(enabled) => onChange({ ...config, loadGrowth: { ...config.loadGrowth, enabled } })}
            >
              {config.loadGrowth.enabled && (
                <LoadGrowthSection
                  config={config.loadGrowth}
                  onChange={(loadGrowth) => onChange({ ...config, loadGrowth })}
                />
              )}
            </CollapsibleSection>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============= Collapsible Section Wrapper =============

function CollapsibleSection({ 
  icon, 
  title, 
  badge,
  toggleEnabled,
  onToggleEnabled,
  children,
  defaultOpen = false,
}: { 
  icon: React.ReactNode;
  title: string;
  badge?: boolean;
  toggleEnabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1">
              {icon}
              <Label className="text-sm font-medium cursor-pointer">{title}</Label>
              {badge && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Active</Badge>}
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          {onToggleEnabled !== undefined && (
            <Switch
              checked={toggleEnabled}
              onCheckedChange={onToggleEnabled}
            />
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============= Section Components =============

function SeasonalSection({ 
  config, 
  onChange 
}: { 
  config: SeasonalConfig; 
  onChange: (config: SeasonalConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Monthly irradiance factors adjust solar generation throughout the year
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">High Demand Load Factor</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[config.highDemandLoadMultiplier * 100]}
              onValueChange={([v]) => onChange({ ...config, highDemandLoadMultiplier: v / 100 })}
              min={90}
              max={130}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-12 text-right">{(config.highDemandLoadMultiplier * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Low Demand Load Factor</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[config.lowDemandLoadMultiplier * 100]}
              onValueChange={([v]) => onChange({ ...config, lowDemandLoadMultiplier: v / 100 })}
              min={70}
              max={110}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-12 text-right">{(config.lowDemandLoadMultiplier * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DegradationSection({ 
  config, 
  onChange,
  projectLifetime = 20,
  includesBattery = false
}: { 
  config: DegradationConfig; 
  onChange: (config: DegradationConfig) => void;
  projectLifetime?: number;
  includesBattery?: boolean;
}) {
  const [panelApplyRate, setPanelApplyRate] = useState(config.panelSimpleRate ?? 0.5);
  const [batteryApplyRate, setBatteryApplyRate] = useState(config.batterySimpleRate ?? 3.0);
  
  // Ensure arrays are the right length
  const ensureArrayLength = (arr: number[], length: number, defaultValue: number): number[] => {
    const newArr = [...arr];
    while (newArr.length < length) newArr.push(defaultValue);
    return newArr.slice(0, length);
  };
  
  const panelRates = ensureArrayLength(config.panelYearlyRates || [], projectLifetime, config.panelSimpleRate || 0.5);
  const batteryRates = ensureArrayLength(config.batteryYearlyRates || [], projectLifetime, config.batterySimpleRate || 3.0);
  
  const handlePanelYearChange = (index: number, value: number) => {
    const newRates = [...panelRates];
    newRates[index] = value;
    onChange({ ...config, panelYearlyRates: newRates });
  };
  
  const handleBatteryYearChange = (index: number, value: number) => {
    const newRates = [...batteryRates];
    newRates[index] = value;
    onChange({ ...config, batteryYearlyRates: newRates });
  };
  
  const applyPanelRateToAll = () => {
    onChange({ ...config, panelYearlyRates: Array(projectLifetime).fill(panelApplyRate) });
  };
  
  const applyBatteryRateToAll = () => {
    onChange({ ...config, batteryYearlyRates: Array(projectLifetime).fill(batteryApplyRate) });
  };

  return (
    <div className="space-y-4">
      {/* Side-by-side layout: Panel (left) and Battery (right) - or full width if no battery */}
      <div className={includesBattery ? "grid grid-cols-2 gap-4" : ""}>
            {/* Panel Degradation - LEFT (or full width) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Panel Degradation</Label>
                <RadioGroup
                  value={config.panelDegradationMode || 'simple'}
                  onValueChange={(mode: 'simple' | 'yearly') => onChange({ ...config, panelDegradationMode: mode })}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="simple" id="panel-simple" className="h-3 w-3" />
                    <Label htmlFor="panel-simple" className="text-[10px] cursor-pointer">Simple</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="yearly" id="panel-yearly" className="h-3 w-3" />
                    <Label htmlFor="panel-yearly" className="text-[10px] cursor-pointer">Yearly</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {(config.panelDegradationMode || 'simple') === 'simple' ? (
                <div className="flex items-center gap-2">
                  <Slider
                    value={[(config.panelSimpleRate ?? 0.5) * 10]}
                    onValueChange={([v]) => onChange({ ...config, panelSimpleRate: v / 10 })}
                    min={2}
                    max={15}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={config.panelSimpleRate ?? 0.5}
                    onChange={(e) => onChange({ ...config, panelSimpleRate: parseFloat(e.target.value) || 0.5 })}
                    className="w-14 h-7 text-xs text-right"
                    step={0.1}
                    min={0}
                    max={5}
                  />
                  <span className="text-[10px] text-muted-foreground">%/yr</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <ScrollArea className="h-48 rounded border bg-muted/20 p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {panelRates.map((rate, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground w-5">Y{idx + 1}</span>
                          <Input
                            type="number"
                            value={rate}
                            onChange={(e) => handlePanelYearChange(idx, parseFloat(e.target.value) || 0)}
                            className="h-6 text-[10px] text-center p-1"
                            step={0.1}
                            min={0}
                            max={10}
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Set rate:</Label>
                    <Input
                      type="number"
                      value={panelApplyRate}
                      onChange={(e) => setPanelApplyRate(parseFloat(e.target.value) || 0.5)}
                      className="w-20 h-6 text-[10px] text-center"
                      step={0.1}
                      min={0}
                      max={10}
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[10px]"
                      onClick={applyPanelRateToAll}
                    >
                      Apply to all
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Battery Degradation - RIGHT (only if battery is included) */}
            {includesBattery && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Battery Degradation</Label>
                  <RadioGroup
                    value={config.batteryDegradationMode || 'simple'}
                    onValueChange={(mode: 'simple' | 'yearly') => onChange({ ...config, batteryDegradationMode: mode })}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="simple" id="battery-simple" className="h-3 w-3" />
                      <Label htmlFor="battery-simple" className="text-[10px] cursor-pointer">Simple</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="yearly" id="battery-yearly" className="h-3 w-3" />
                      <Label htmlFor="battery-yearly" className="text-[10px] cursor-pointer">Yearly</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {(config.batteryDegradationMode || 'simple') === 'simple' ? (
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[(config.batterySimpleRate ?? 3.0) * 10]}
                      onValueChange={([v]) => onChange({ ...config, batterySimpleRate: v / 10 })}
                      min={10}
                      max={60}
                      step={5}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={config.batterySimpleRate ?? 3.0}
                      onChange={(e) => onChange({ ...config, batterySimpleRate: parseFloat(e.target.value) || 3.0 })}
                      className="w-14 h-7 text-xs text-right"
                      step={0.5}
                      min={0}
                      max={10}
                    />
                    <span className="text-[10px] text-muted-foreground">%/yr</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ScrollArea className="h-48 rounded border bg-muted/20 p-2">
                      <div className="grid grid-cols-4 gap-1">
                        {batteryRates.map((rate, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground w-5">Y{idx + 1}</span>
                            <Input
                              type="number"
                              value={rate}
                              onChange={(e) => handleBatteryYearChange(idx, parseFloat(e.target.value) || 0)}
                              className="h-6 text-[10px] text-center p-1"
                              step={0.5}
                              min={0}
                              max={15}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={batteryApplyRate}
                        onChange={(e) => setBatteryApplyRate(parseFloat(e.target.value) || 3.0)}
                        className="w-14 h-6 text-[10px] text-center"
                        step={0.5}
                        min={0}
                        max={15}
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-[10px] flex-1"
                        onClick={applyBatteryRateToAll}
                      >
                        Apply to all years
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Battery EOL Capacity - only show if battery is included */}
          {includesBattery && (
            <div className="flex items-center gap-2">
              <Label className="text-xs flex-1">Battery End-of-Life Capacity</Label>
              <Input
                type="number"
                value={config.batteryEolCapacity}
                onChange={(e) => onChange({ ...config, batteryEolCapacity: parseInt(e.target.value) || 70 })}
                className="w-16 h-7 text-xs text-right"
                min={50}
                max={90}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          )}
    </div>
  );
}

function FinancialSection({ 
  config, 
  onChange 
}: { 
  config: AdvancedFinancialConfig; 
  onChange: (config: AdvancedFinancialConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tariff Escalation (%/yr)</Label>
          <Input
            type="number"
            value={config.tariffEscalationRate}
            onChange={(e) => onChange({ ...config, tariffEscalationRate: parseFloat(e.target.value) || 0 })}
            min={0}
            max={25}
            step={0.5}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Inflation Rate (%)</Label>
          <Input
            type="number"
            value={config.inflationRate}
            onChange={(e) => onChange({ ...config, inflationRate: parseFloat(e.target.value) || 0 })}
            min={0}
            max={15}
            step={0.5}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discount Rate (%)</Label>
          <Input
            type="number"
            value={config.discountRate}
            onChange={(e) => onChange({ ...config, discountRate: parseFloat(e.target.value) || 0 })}
            min={0}
            max={20}
            step={0.5}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Project Lifetime (years)</Label>
          <Input
            type="number"
            value={config.projectLifetimeYears}
            onChange={(e) => onChange({ ...config, projectLifetimeYears: parseInt(e.target.value) || 25 })}
            min={10}
            max={30}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center justify-between pt-4">
          <Label className="text-xs">Sensitivity Analysis</Label>
          <Switch
            checked={config.sensitivityEnabled}
            onCheckedChange={(sensitivityEnabled) => onChange({ ...config, sensitivityEnabled })}
          />
        </div>
      </div>
      {config.sensitivityEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Variation Range (%)</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[config.sensitivityVariation]}
              onValueChange={([v]) => onChange({ ...config, sensitivityVariation: v })}
              min={5}
              max={40}
              step={5}
              className="flex-1"
            />
            <span className="text-xs w-12 text-right">±{config.sensitivityVariation}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GridConstraintsSection({ 
  config, 
  onChange 
}: { 
  config: GridConstraintsConfig; 
  onChange: (config: GridConstraintsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Export Limit</Label>
        <Switch
          checked={config.exportLimitEnabled}
          onCheckedChange={(exportLimitEnabled) => onChange({ ...config, exportLimitEnabled })}
        />
      </div>
      {config.exportLimitEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Max Export (kW)</Label>
          <Input
            type="number"
            value={config.maxExportKw}
            onChange={(e) => onChange({ ...config, maxExportKw: parseFloat(e.target.value) || 0 })}
            min={0}
            step={10}
            className="h-8 text-xs"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Wheeling Charges</Label>
        <Switch
          checked={config.wheelingEnabled}
          onCheckedChange={(wheelingEnabled) => onChange({ ...config, wheelingEnabled })}
        />
      </div>
      {config.wheelingEnabled && (
        <div className="space-y-1">
          <Label className="text-xs">Wheeling Charge (R/kWh)</Label>
          <Input
            type="number"
            value={config.wheelingChargePerKwh}
            onChange={(e) => onChange({ ...config, wheelingChargePerKwh: parseFloat(e.target.value) || 0 })}
            min={0}
            step={0.05}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function LoadGrowthSection({ 
  config, 
  onChange 
}: { 
  config: LoadGrowthConfig; 
  onChange: (config: LoadGrowthConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Annual Growth Rate (%)</Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[config.annualGrowthRate * 10]}
            onValueChange={([v]) => onChange({ ...config, annualGrowthRate: v / 10 })}
            min={0}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="text-xs w-12 text-right">{config.annualGrowthRate.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">New Tenant Projection</Label>
        <Switch
          checked={config.newTenantEnabled}
          onCheckedChange={(newTenantEnabled) => onChange({ ...config, newTenantEnabled })}
        />
      </div>
      {config.newTenantEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Year Joining</Label>
            <Input
              type="number"
              value={config.newTenantYear}
              onChange={(e) => onChange({ ...config, newTenantYear: parseInt(e.target.value) || 1 })}
              min={1}
              max={25}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monthly Load (kWh)</Label>
            <Input
              type="number"
              value={config.newTenantLoadKwh}
              onChange={(e) => onChange({ ...config, newTenantLoadKwh: parseFloat(e.target.value) || 0 })}
              min={0}
              step={500}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============= Battery Characteristics Section =============

function BatteryCharacteristicsSection({
  chargeCRate,
  onChargeCRateChange,
  dischargeCRate,
  onDischargeCRateChange,
  doD,
  onDoDChange,
  minSoC,
  onMinSoCChange,
  maxSoC,
  onMaxSoCChange,
}: {
  chargeCRate: number;
  onChargeCRateChange?: (value: number) => void;
  dischargeCRate: number;
  onDischargeCRateChange?: (value: number) => void;
  doD: number;
  onDoDChange?: (value: number) => void;
  minSoC: number;
  onMinSoCChange?: (value: number) => void;
  maxSoC: number;
  onMaxSoCChange?: (value: number) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        <Battery className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Battery Characteristics</Label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Charging C-Rate</Label>
          <Input
            type="number"
            value={chargeCRate}
            onChange={(e) => onChargeCRateChange?.(Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 0.5)))}
            className="h-8 text-xs"
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discharging C-Rate</Label>
          <Input
            type="number"
            value={dischargeCRate}
            onChange={(e) => onDischargeCRateChange?.(Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 0.5)))}
            className="h-8 text-xs"
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Depth of Discharge (%)</Label>
          <Input
            type="number"
            value={doD}
            onChange={(e) => onDoDChange?.(Math.max(10, Math.min(100, parseInt(e.target.value) || 85)))}
            className="h-8 text-xs"
            min={10}
            max={100}
            step={5}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Min SoC (%)</Label>
          <Input
            type="number"
            value={minSoC}
            onChange={(e) => {
              const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
              onMinSoCChange?.(val);
              if (val >= maxSoC) onMaxSoCChange?.(Math.min(100, val + 5));
            }}
            className="h-8 text-xs"
            min={0}
            max={100}
            step={5}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max SoC (%)</Label>
          <Input
            type="number"
            value={maxSoC}
            onChange={(e) => {
              const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
              onMaxSoCChange?.(val);
              if (val <= minSoC) onMinSoCChange?.(Math.max(0, val - 5));
            }}
            className="h-8 text-xs"
            min={0}
            max={100}
            step={5}
          />
        </div>
      </div>
    </div>
  );
}

export default AdvancedSimulationConfigPanel;
