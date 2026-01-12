import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Loader2 } from "lucide-react";
import { useSimulationPresets, CreatePresetInput } from "@/hooks/useSimulationPresets";

export interface PresetConfig {
  dcAcRatio: number;
  batteryCapacity: number;
  batteryPower: number;
  systemLosses: number;
  powerFactor: number;
  showPVProfile: boolean;
  showBattery: boolean;
  show1to1Comparison: boolean;
  useSolcast: boolean;
}

interface SavePresetDialogProps {
  config: PresetConfig;
}

export function SavePresetDialog({ config }: SavePresetDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  
  const { createPreset } = useSimulationPresets();

  const handleSave = async () => {
    if (!name.trim()) return;

    const presetInput: CreatePresetInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      config: config,
      is_default: isDefault,
    };

    await createPreset.mutateAsync(presetInput);
    
    // Reset form and close
    setName("");
    setDescription("");
    setIsDefault(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Save className="h-3 w-3" />
          Save as Preset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Simulation Preset</DialogTitle>
          <DialogDescription>
            Save your current settings as a reusable preset that can be applied to any project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder="e.g., Standard Commercial, High Overpaneling"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="preset-description">Description (optional)</Label>
            <Textarea
              id="preset-description"
              placeholder="Describe when to use this preset..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            Set as default preset
          </Label>

          {/* Config Preview */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Configuration to save:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">DC/AC Ratio:</span>
              <span className="font-medium">{(config.dcAcRatio * 100).toFixed(0)}%</span>
              
              <span className="text-muted-foreground">Battery Capacity:</span>
              <span className="font-medium">{config.batteryCapacity} kWh</span>
              
              <span className="text-muted-foreground">Battery Power:</span>
              <span className="font-medium">{config.batteryPower} kW</span>
              
              <span className="text-muted-foreground">System Losses:</span>
              <span className="font-medium">{(config.systemLosses * 100).toFixed(0)}%</span>
              
              <span className="text-muted-foreground">Power Factor:</span>
              <span className="font-medium">{config.powerFactor.toFixed(2)}</span>
              
              <span className="text-muted-foreground">PV Enabled:</span>
              <span className="font-medium">{config.showPVProfile ? "Yes" : "No"}</span>
              
              <span className="text-muted-foreground">Battery Enabled:</span>
              <span className="font-medium">{config.showBattery ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || createPreset.isPending}
          >
            {createPreset.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Preset
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
