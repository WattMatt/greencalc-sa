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
}

export function AdvancedSimulationConfigPanel({ 
  config, 
  onChange 
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
                            onChange(preset.config);
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

            <Separator />

            {/* Seasonal Variation */}
            <SeasonalSection 
              config={config.seasonal}
              onChange={(seasonal) => onChange({ ...config, seasonal })}
            />
            
            {/* Degradation Modeling */}
            <DegradationSection
              config={config.degradation}
              onChange={(degradation) => onChange({ ...config, degradation })}
            />
            
            {/* Financial Sophistication */}
            <FinancialSection
              config={config.financial}
              onChange={(financial) => onChange({ ...config, financial })}
            />
            
            {/* Grid Constraints */}
            <GridConstraintsSection
              config={config.gridConstraints}
              onChange={(gridConstraints) => onChange({ ...config, gridConstraints })}
            />
            
            {/* Load Growth */}
            <LoadGrowthSection
              config={config.loadGrowth}
              onChange={(loadGrowth) => onChange({ ...config, loadGrowth })}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
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
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-medium">Seasonal Variation</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
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
      )}
    </div>
  );
}

function DegradationSection({ 
  config, 
  onChange 
}: { 
  config: DegradationConfig; 
  onChange: (config: DegradationConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="h-4 w-4 text-green-500" />
          <Label className="text-sm font-medium">Degradation Modeling</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Panel Degradation (%/year)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.panelDegradationRate * 10]}
                  onValueChange={([v]) => onChange({ ...config, panelDegradationRate: v / 10 })}
                  min={2}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right">{config.panelDegradationRate.toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Battery Degradation (%/year)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.batteryDegradationRate * 10]}
                  onValueChange={([v]) => onChange({ ...config, batteryDegradationRate: v / 10 })}
                  min={10}
                  max={50}
                  step={5}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right">{config.batteryDegradationRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Inverter Replacement Year</Label>
              <Input
                type="number"
                value={config.inverterReplacementYear}
                onChange={(e) => onChange({ ...config, inverterReplacementYear: parseInt(e.target.value) || 12 })}
                min={5}
                max={25}
                className="h-8 text-xs"
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Replacement Cost (R)</Label>
              <Input
                type="number"
                value={config.inverterReplacementCost}
                onChange={(e) => onChange({ ...config, inverterReplacementCost: parseInt(e.target.value) || 0 })}
                min={0}
                step={5000}
                className="h-8 text-xs"
              />
            </div>
          </div>
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
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <Label className="text-sm font-medium">Financial Sophistication</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
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
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <Label className="text-sm font-medium">Grid Constraints</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
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
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-purple-500" />
          <Label className="text-sm font-medium">Load Growth</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
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
      )}
    </div>
  );
}

export default AdvancedSimulationConfigPanel;
