import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useMemo, useEffect } from 'react';
import { PlantSetupConfig, DCCableConfig, ACCableConfig, WalkwayConfig, CableTrayConfig, InverterLayoutConfig, SolarModuleConfig, PanelOrientation, CableTrayType } from '../types';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type ConfigurableObjectType = 'dcCable' | 'acCable' | 'walkway' | 'cableTray' | 'inverter' | 'pvArray';

interface ConfigOption {
  id: string;
  name: string;
  subtitle?: string;
}

// Properties that can be edited per object type
export interface ObjectProperties {
  // Walkway / Cable Tray
  length?: number;
  // Inverter
  name?: string;
  // PV Array
  rows?: number;
  columns?: number;
  orientation?: PanelOrientation;
  // Cable Tray specific
  cableType?: CableTrayType;
  // All object types
  elevation?: number; // meters above ground level
}

interface ObjectConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectType: ConfigurableObjectType;
  selectedCount: number;
  currentConfigId: string | null;
  currentProperties?: ObjectProperties;
  plantSetupConfig: PlantSetupConfig;
  onApply: (newConfigId: string | null, properties?: ObjectProperties) => void;
}

export function ObjectConfigModal({
  isOpen,
  onClose,
  objectType,
  selectedCount,
  currentConfigId,
  currentProperties,
  plantSetupConfig,
  onApply,
}: ObjectConfigModalProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(currentConfigId);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  
  // Property state
  const [length, setLength] = useState<number | undefined>(currentProperties?.length);
  const [name, setName] = useState<string | undefined>(currentProperties?.name);
  const [rows, setRows] = useState<number | undefined>(currentProperties?.rows);
  const [columns, setColumns] = useState<number | undefined>(currentProperties?.columns);
  const [orientation, setOrientation] = useState<PanelOrientation | undefined>(currentProperties?.orientation);
  const [cableType, setCableType] = useState<CableTrayType | undefined>(currentProperties?.cableType);
  const [elevation, setElevation] = useState<number | undefined>(currentProperties?.elevation);

  // Reset state when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      setSelectedConfigId(currentConfigId);
      setLength(currentProperties?.length);
      setName(currentProperties?.name);
      setRows(currentProperties?.rows);
      setColumns(currentProperties?.columns);
      setOrientation(currentProperties?.orientation);
      setCableType(currentProperties?.cableType);
      setElevation(currentProperties?.elevation);
    }
  }, [currentConfigId, currentProperties, isOpen]);

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

  // Determine if properties are editable for this object type
  // Properties = things set when placing on canvas (to be defined by user)
  const hasEditableProperties = useMemo(() => {
    // All object types now have elevation; cable trays also have cableType
    return true;
  }, []);

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
    const properties: ObjectProperties = {};
    
    // Collect configuration-related properties based on object type
    if (objectType === 'walkway') {
      if (length !== undefined) properties.length = length;
    } else if (objectType === 'cableTray') {
      if (length !== undefined) properties.length = length;
      if (cableType !== undefined) properties.cableType = cableType;
    } else if (objectType === 'inverter') {
      if (name !== undefined) properties.name = name;
    } else if (objectType === 'pvArray') {
      if (rows !== undefined) properties.rows = rows;
      if (columns !== undefined) properties.columns = columns;
      if (orientation !== undefined) properties.orientation = orientation;
    }
    
    // Elevation applies to all types
    if (elevation !== undefined) properties.elevation = elevation;
    
    onApply(selectedConfigId, Object.keys(properties).length > 0 ? properties : undefined);
    onClose();
  };

  const renderPropertiesContent = () => {
    return (
      <div className="space-y-3">
        {/* Cable tray specific: AC/DC cable type selection */}
        {objectType === 'cableTray' && (
          <div className="space-y-2">
            <Label htmlFor="cableType">Cable Type</Label>
            <Select
              value={cableType || ''}
              onValueChange={(val) => setCableType(val as CableTrayType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cable type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dc">DC Cable Tray</SelectItem>
                <SelectItem value="ac">AC Cable Tray</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cables of the matching type will snap to this tray during placement.
            </p>
          </div>
        )}

        {/* Elevation - available for all object types */}
        <div className="space-y-2">
          <Label htmlFor="elevation">Elevation (m)</Label>
          <Input
            id="elevation"
            type="number"
            step="0.1"
            min="0"
            value={elevation ?? 0}
            onChange={(e) => setElevation(e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Height above ground level in meters.
          </p>
        </div>
      </div>
    );
  };

  // Render configuration-specific inputs (length, name, rows/columns, etc.)
  const renderConfigurationInputs = () => {
    switch (objectType) {
      case 'walkway':
      case 'cableTray':
        return (
          <div className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label htmlFor="length">Length (m)</Label>
              <Input
                id="length"
                type="number"
                step="0.1"
                min="0.1"
                value={length ?? ''}
                onChange={(e) => setLength(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Enter length..."
              />
            </div>
          </div>
        );
      case 'inverter':
        return (
          <div className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name ?? ''}
                onChange={(e) => setName(e.target.value || undefined)}
                placeholder="Enter name..."
              />
            </div>
          </div>
        );
      case 'pvArray':
        return (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rows">Rows</Label>
                <Input
                  id="rows"
                  type="number"
                  min="1"
                  value={rows ?? ''}
                  onChange={(e) => setRows(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Rows..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="columns">Columns</Label>
                <Input
                  id="columns"
                  type="number"
                  min="1"
                  value={columns ?? ''}
                  onChange={(e) => setColumns(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Columns..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select
                value={orientation}
                onValueChange={(val) => setOrientation(val as PanelOrientation)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select orientation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      default:
        return null;
    }
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

        <div className="py-4 space-y-4">
          {/* Properties Section */}
          <Collapsible open={propertiesOpen} onOpenChange={setPropertiesOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={`flex items-center justify-between w-full p-3 rounded-lg border text-left transition-colors ${
                  hasEditableProperties 
                    ? 'hover:bg-accent/50 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                disabled={!hasEditableProperties}
              >
                <span className="font-medium">Properties</span>
                {propertiesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-1">
              {renderPropertiesContent()}
            </CollapsibleContent>
          </Collapsible>

          {/* Configuration Section */}
          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-accent/50 text-left transition-colors cursor-pointer">
                <span className="font-medium">Configuration</span>
                {configOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-1">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={selectedConfigId || ''}
                  onValueChange={setSelectedConfigId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select configuration..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        <div>
                          <div className="font-medium">{config.name}</div>
                          {config.subtitle && (
                            <div className="text-xs text-muted-foreground">{config.subtitle}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Additional configuration inputs based on object type */}
              {renderConfigurationInputs()}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
