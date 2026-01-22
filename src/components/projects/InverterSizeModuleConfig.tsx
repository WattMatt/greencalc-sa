import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    onChange({
      ...config,
      customModule: {
        ...config.customModule!,
        [field]: numValue,
      },
    });
  };

  const isCustomSize = !INVERTER_SIZES.some(
    (size) => size.kw === config.inverterSize
  );

  return (
    <div className="space-y-4">
      {/* Inverter Size Section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4" />
          Inverter Size (AC)
        </Label>
        <div className="flex gap-2">
          <Select
            value={isCustomSize ? "custom" : config.inverterSize.toString()}
            onValueChange={(value) => {
              if (value === "custom") {
                // Keep current value but mark as custom
              } else {
                handleInverterSizeChange(value);
              }
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {INVERTER_SIZES.map((size) => (
                <SelectItem key={size.kw} value={size.kw.toString()}>
                  {size.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.inverterSize}
              onChange={(e) => handleCustomInverterSize(e.target.value)}
              className="w-24"
              min={1}
            />
            <span className="text-sm text-muted-foreground">kW</span>
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-4 gap-2 pt-2">
            <div>
              <Label className="text-xs">Power (W)</Label>
              <Input
                type="number"
                value={config.customModule.power_wp}
                onChange={(e) =>
                  handleCustomModuleChange("power_wp", e.target.value)
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Width (m)</Label>
              <Input
                type="number"
                value={config.customModule.width_m}
                onChange={(e) =>
                  handleCustomModuleChange("width_m", e.target.value)
                }
                className="h-8"
                step="0.001"
              />
            </div>
            <div>
              <Label className="text-xs">Length (m)</Label>
              <Input
                type="number"
                value={config.customModule.length_m}
                onChange={(e) =>
                  handleCustomModuleChange("length_m", e.target.value)
                }
                className="h-8"
                step="0.001"
              />
            </div>
            <div>
              <Label className="text-xs">Efficiency (%)</Label>
              <Input
                type="number"
                value={config.customModule.efficiency}
                onChange={(e) =>
                  handleCustomModuleChange("efficiency", e.target.value)
                }
                className="h-8"
                step="0.1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
