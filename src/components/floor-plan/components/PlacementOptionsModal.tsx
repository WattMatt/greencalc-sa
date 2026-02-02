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
import { Separator } from '@/components/ui/separator';
import { Tool } from '../types';
import { DimensionInput } from './DimensionInput';

export type PlacementItemType = 'inverter' | 'walkway' | 'cable_tray' | 'dc_combiner' | 'ac_disconnect' | 'main_board';

export interface PlacementConfig {
  orientation: 'portrait' | 'landscape';
  minSpacing: number;
}

interface PlacementOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: PlacementItemType;
  itemName: string;
  defaultOrientation?: 'portrait' | 'landscape';
  defaultMinSpacing?: number;
  dimensions?: { width: number; height: number };
  onConfirm: (config: PlacementConfig) => void;
}

const TOOL_TO_TYPE: Record<Tool, PlacementItemType | null> = {
  [Tool.PLACE_INVERTER]: 'inverter',
  [Tool.PLACE_WALKWAY]: 'walkway',
  [Tool.PLACE_CABLE_TRAY]: 'cable_tray',
  [Tool.PLACE_DC_COMBINER]: 'dc_combiner',
  [Tool.PLACE_AC_DISCONNECT]: 'ac_disconnect',
  [Tool.PLACE_MAIN_BOARD]: 'main_board',
  [Tool.SELECT]: null,
  [Tool.PAN]: null,
  [Tool.SCALE]: null,
  [Tool.LINE_DC]: null,
  [Tool.LINE_AC]: null,
  [Tool.ROOF_MASK]: null,
  [Tool.ROOF_DIRECTION]: null,
  [Tool.PV_ARRAY]: null,
  [Tool.DIMENSION]: null,
};

export function toolToPlacementType(tool: Tool): PlacementItemType | null {
  return TOOL_TO_TYPE[tool] ?? null;
}

const ITEM_TYPE_LABELS: Record<PlacementItemType, string> = {
  inverter: 'Inverter',
  walkway: 'Walkway',
  cable_tray: 'Cable Tray',
  dc_combiner: 'DC Combiner',
  ac_disconnect: 'AC Disconnect',
  main_board: 'Main Board',
};

export function PlacementOptionsModal({
  isOpen,
  onClose,
  itemType,
  itemName,
  defaultOrientation = 'portrait',
  defaultMinSpacing = 0.3,
  dimensions,
  onConfirm,
}: PlacementOptionsModalProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(defaultOrientation);
  const [minSpacing, setMinSpacing] = useState<number>(defaultMinSpacing);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOrientation(defaultOrientation);
      setMinSpacing(defaultMinSpacing);
    }
  }, [isOpen, defaultOrientation, defaultMinSpacing]);

  const spacingNum = minSpacing;
  const itemLabel = itemName || ITEM_TYPE_LABELS[itemType];

  // Calculate displayed dimensions based on orientation
  const displayWidth = dimensions ? (orientation === 'portrait' ? dimensions.width : dimensions.height) : null;
  const displayHeight = dimensions ? (orientation === 'portrait' ? dimensions.height : dimensions.width) : null;

  const MIN_SPACING_THRESHOLD = 0.05; // 5cm minimum
  const effectiveSpacing = Math.max(MIN_SPACING_THRESHOLD, spacingNum);
  const isBelowMinimum = spacingNum < MIN_SPACING_THRESHOLD;

  const handleConfirm = () => {
    onConfirm({
      orientation,
      minSpacing: effectiveSpacing,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place {itemLabel}</DialogTitle>
          <DialogDescription>
            Configure placement options, then click on the canvas to place. Press ESC to cancel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Orientation</Label>
            <RadioGroup value={orientation} onValueChange={(v) => setOrientation(v as 'portrait' | 'landscape')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="portrait" id="placement-portrait" />
                <Label htmlFor="placement-portrait" className="font-normal">
                  Portrait
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="landscape" id="placement-landscape" />
                <Label htmlFor="placement-landscape" className="font-normal">
                  Landscape
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <DimensionInput
              label="Minimum Spacing"
              value={minSpacing}
              onChange={setMinSpacing}
            />
            <p className="text-xs text-muted-foreground">
              Minimum gap between placed items for maintenance access.
            </p>
            {isBelowMinimum && (
              <p className="text-xs text-amber-600">
                Minimum spacing enforced at 5cm for maintenance access.
              </p>
            )}
          </div>

          <Separator />

          <div className="bg-muted p-3 rounded-md text-sm space-y-1">
            <p>Item: <span className="font-medium">{itemLabel}</span></p>
            {displayWidth !== null && displayHeight !== null && (
              <p>Size: <span className="font-medium">{displayWidth.toFixed(2)}m × {displayHeight.toFixed(2)}m</span></p>
            )}
            <p>Min Spacing: <span className="font-medium">{effectiveSpacing.toFixed(2)}m</span></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Ready to Place</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
