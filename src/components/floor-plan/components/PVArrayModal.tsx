import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PanelOrientation, PVPanelConfig } from '../types';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Settings2 } from 'lucide-react';
import { DimensionInput } from './DimensionInput';

export interface PVArrayConfig {
  rows: number;
  columns: number;
  orientation: PanelOrientation;
  minSpacing?: number; // Minimum distance between array groups in meters
}

interface PVArrayModalProps {
  isOpen: boolean;
  onClose: () => void;
  pvPanelConfig: PVPanelConfig;
  onConfirm: (config: PVArrayConfig) => void;
  initialConfig?: PVArrayConfig;
  isEditing?: boolean;
}

export function PVArrayModal({ isOpen, onClose, pvPanelConfig, onConfirm, initialConfig, isEditing }: PVArrayModalProps) {
  const [rows, setRows] = useState<string>('2');
  const [columns, setColumns] = useState<string>('10');
  const [orientation, setOrientation] = useState<PanelOrientation>('portrait');
  const [minSpacing, setMinSpacing] = useState<number>(0.5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset form when modal opens, using initial values if editing
  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setRows(String(initialConfig.rows));
        setColumns(String(initialConfig.columns));
        setOrientation(initialConfig.orientation);
        setMinSpacing(initialConfig.minSpacing ?? 0.5);
      } else {
        setRows('2');
        setColumns('10');
        setOrientation('portrait');
        setMinSpacing(0.5);
      }
    }
  }, [isOpen, initialConfig]);

  const rowsNum = parseInt(rows) || 1;
  const colsNum = parseInt(columns) || 1;
  const panelCount = rowsNum * colsNum;
  const capacityKwp = (panelCount * pvPanelConfig.wattage) / 1000;
  const spacingNum = minSpacing;

  // Calculate array dimensions
  const panelW = orientation === 'portrait' ? pvPanelConfig.width : pvPanelConfig.length;
  const panelL = orientation === 'portrait' ? pvPanelConfig.length : pvPanelConfig.width;
  const arrayWidth = colsNum * panelW;
  const arrayLength = rowsNum * panelL;

  const handleConfirm = () => {
    onConfirm({
      rows: rowsNum,
      columns: colsNum,
      orientation,
      minSpacing: spacingNum,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit PV Array' : 'Place PV Array'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modify the array layout. Press R to rotate when selected.'
              : 'Configure the array layout then click on a roof mask to place. Press ESC to stop placing.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rows">Rows</Label>
              <Input
                id="rows"
                type="number"
                min="1"
                max="50"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="columns">Columns</Label>
              <Input
                id="columns"
                type="number"
                min="1"
                max="100"
                value={columns}
                onChange={(e) => setColumns(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Panel Orientation</Label>
            <RadioGroup value={orientation} onValueChange={(v) => setOrientation(v as PanelOrientation)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="portrait" id="portrait" />
                <Label htmlFor="portrait" className="font-normal">
                  Portrait ({pvPanelConfig.width}m × {pvPanelConfig.length}m)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="landscape" id="landscape" />
                <Label htmlFor="landscape" className="font-normal">
                  Landscape ({pvPanelConfig.length}m × {pvPanelConfig.width}m)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Advanced Options
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              <div className="space-y-2">
                <DimensionInput
                  label="Minimum Spacing Between Arrays"
                  value={minSpacing}
                  onChange={setMinSpacing}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum gap between array groups for walkways and maintenance access.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          <div className="bg-muted p-3 rounded-md text-sm space-y-1">
            <p>Panels: <span className="font-medium">{panelCount}</span></p>
            <p>Capacity: <span className="font-medium">{capacityKwp.toFixed(2)} kWp</span></p>
            <p>Array Size: <span className="font-medium">{arrayWidth.toFixed(2)}m × {arrayLength.toFixed(2)}m</span></p>
            {spacingNum > 0 && (
              <p>Min Spacing: <span className="font-medium">{spacingNum.toFixed(1)}m</span></p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>{isEditing ? 'Update' : 'Ready to Place'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
