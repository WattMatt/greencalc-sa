import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState, useMemo } from 'react';
import { PlantSetupConfig, DCCableConfig, ACCableConfig, WalkwayConfig, CableTrayConfig, InverterLayoutConfig, SolarModuleConfig } from '../types';

export type ConfigurableObjectType = 'dcCable' | 'acCable' | 'walkway' | 'cableTray' | 'inverter' | 'pvArray';

interface ConfigOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface ObjectConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectType: ConfigurableObjectType;
  selectedCount: number;
  currentConfigId: string | null;
  plantSetupConfig: PlantSetupConfig;
  onApply: (newConfigId: string) => void;
}

export function ObjectConfigModal({
  isOpen,
  onClose,
  objectType,
  selectedCount,
  currentConfigId,
  plantSetupConfig,
  onApply,
}: ObjectConfigModalProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(currentConfigId);

  // Reset selection when modal opens with new config
  useMemo(() => {
    setSelectedConfigId(currentConfigId);
  }, [currentConfigId, isOpen]);

  // Get available configs based on object type
  const availableConfigs = useMemo((): ConfigOption[] => {
    switch (objectType) {
      case 'dcCable':
        return (plantSetupConfig.dcCables || []).map((c: DCCableConfig) => ({
          id: c.id,
          name: c.name,
          subtitle: `${c.diameter}mm² ${c.material}`,
        }));
      case 'acCable':
        return (plantSetupConfig.acCables || []).map((c: ACCableConfig) => ({
          id: c.id,
          name: c.name,
          subtitle: `${c.diameter}mm² ${c.material}`,
        }));
      case 'walkway':
        return plantSetupConfig.walkways.map((w: WalkwayConfig) => ({
          id: w.id,
          name: w.name,
          subtitle: `${w.width}m × ${w.length}m`,
        }));
      case 'cableTray':
        return plantSetupConfig.cableTrays.map((t: CableTrayConfig) => ({
          id: t.id,
          name: t.name,
          subtitle: `${t.width}m × ${t.length}m`,
        }));
      case 'inverter':
        return plantSetupConfig.inverters.map((i: InverterLayoutConfig) => ({
          id: i.id,
          name: i.name,
          subtitle: `${i.acCapacity}kW`,
        }));
      case 'pvArray':
        return plantSetupConfig.solarModules.map((m: SolarModuleConfig) => ({
          id: m.id,
          name: m.name,
          subtitle: `${m.wattage}Wp (${m.width}m × ${m.length}m)`,
        }));
      default:
        return [];
    }
  }, [objectType, plantSetupConfig]);

  // Get display label for object type
  const getObjectTypeLabel = (): string => {
    switch (objectType) {
      case 'dcCable': return 'DC Cable';
      case 'acCable': return 'AC Cable';
      case 'walkway': return 'Walkway';
      case 'cableTray': return 'Cable Tray';
      case 'inverter': return 'Inverter';
      case 'pvArray': return 'Solar Module';
      default: return 'Object';
    }
  };

  const handleApply = () => {
    if (selectedConfigId) {
      onApply(selectedConfigId);
    }
    onClose();
  };

  if (availableConfigs.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change {getObjectTypeLabel()} Configuration</DialogTitle>
            <DialogDescription>
              No configurations available. Please add {getObjectTypeLabel().toLowerCase()} templates in Plant Setup first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change {getObjectTypeLabel()} Configuration</DialogTitle>
          <DialogDescription>
            Applying to {selectedCount} {getObjectTypeLabel()}{selectedCount > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedConfigId || ''}
            onValueChange={setSelectedConfigId}
            className="space-y-3"
          >
            {availableConfigs.map((config) => (
              <div
                key={config.id}
                className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedConfigId(config.id)}
              >
                <RadioGroupItem value={config.id} id={config.id} />
                <Label htmlFor={config.id} className="flex-1 cursor-pointer">
                  <div className="font-medium">{config.name}</div>
                  {config.subtitle && (
                    <div className="text-sm text-muted-foreground">{config.subtitle}</div>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selectedConfigId}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
