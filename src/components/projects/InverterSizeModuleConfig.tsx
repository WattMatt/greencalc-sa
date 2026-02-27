import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Sun } from "lucide-react";
import { SOLAR_MODULE_PRESETS, SolarModulePreset } from "./SolarModulePresets";
import { INVERTER_SIZES, InverterConfig } from "./InverterSizing";

interface InverterSizeModuleConfigProps {
  config: InverterConfig;
  onChange: (config: InverterConfig) => void;
  onSolarCapacityChange: (capacity: number) => void;
}

export function InverterSizeModuleConfig({
  config,
  onChange,
  onSolarCapacityChange,
}: InverterSizeModuleConfigProps) {
  const selectedModule =
    config.selectedModuleId === "custom"
      ? config.customModule
      : SOLAR_MODULE_PRESETS.find((m) => m.id === config.selectedModuleId) ||
        SOLAR_MODULE_PRESETS[0];

  const handleInverterSizeChange = (value: string) => {
    const newSize = parseInt(value);
    onChange({ ...config, inverterSize: newSize });
    onSolarCapacityChange(newSize * config.inverterCount);
  };

  const handleCustomInverterSize = (value: string) => {
    const newSize = parseInt(value) || 0;
    onChange({ ...config, inverterSize: newSize });
    onSolarCapacityChange(newSize * config.inverterCount);
  };

  const handleModuleChange = (moduleId: string) => {
    if (moduleId === "custom") {
      onChange({
        ...config,
        selectedModuleId: "custom",
        customModule: config.customModule || {
          id: "custom",
          name: "Custom Module",
          manufacturer: "Custom",
          power_wp: 550,
          width_m: 1.134,
          length_m: 2.278,
          efficiency: 21.3,
          temp_coefficient: -0.35,
        },
      });
    } else {
      onChange({ ...config, selectedModuleId: moduleId });
    }
  };

  const handleCustomModuleChange = (
    field: keyof SolarModulePreset,
    value: number
  ) => {
    onChange({
      ...config,
      customModule: {
        ...config.customModule!,
        [field]: value,
      },
    });
  };

  const isCustomSize = !INVERTER_SIZES.some(
    (size) => size.kw === config.inverterSize
  );

  return (
    <div className="space-y-4">

      {/* Solar Module Section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Sun className="h-4 w-4" />
          Solar Module
        </Label>
        <div className="flex gap-2 items-center">
          <Select
            value={config.selectedModuleId}
            onValueChange={handleModuleChange}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select module" />
            </SelectTrigger>
            <SelectContent>
              {SOLAR_MODULE_PRESETS.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.name}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom Module</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm font-medium">
            {selectedModule?.power_wp}W
          </span>
        </div>

        {/* Module specs display */}
        {selectedModule && config.selectedModuleId !== "custom" && (
          <div className="text-xs text-muted-foreground">
            Power: {selectedModule.power_wp}W • Area:{" "}
            {(selectedModule.width_m * selectedModule.length_m).toFixed(3)} m² •
            Eff: {selectedModule.efficiency}%
          </div>
        )}

        {/* Custom module inputs */}
        {config.selectedModuleId === "custom" && config.customModule && (
          <div className="space-y-2 pt-2">
            {/* Row 1: Width, Length, Area */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Width (m)</Label>
                <NumericInput
                  value={config.customModule.width_m}
                  onChange={(v) => handleCustomModuleChange("width_m", v)}
                  className="h-8"
                  step="0.001"
                />
              </div>
              <div>
                <Label className="text-xs">Length (m)</Label>
                <NumericInput
                  value={config.customModule.length_m}
                  onChange={(v) => handleCustomModuleChange("length_m", v)}
                  className="h-8"
                  step="0.001"
                />
              </div>
              <div>
                <Label className="text-xs">Area (m²)</Label>
                <Input
                  type="number"
                  value={(config.customModule.width_m * config.customModule.length_m).toFixed(3)}
                  disabled
                  className="h-8 bg-muted"
                />
              </div>
            </div>
            
            {/* Row 2: Power, Efficiency */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Power (W)</Label>
                <NumericInput
                  value={config.customModule.power_wp}
                  onChange={(v) => handleCustomModuleChange("power_wp", v)}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Efficiency (%)</Label>
                <NumericInput
                  value={config.customModule.efficiency}
                  onChange={(v) => handleCustomModuleChange("efficiency", v)}
                  className="h-8"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
