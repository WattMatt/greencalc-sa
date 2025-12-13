import { useState } from 'react';
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
import { PVPanelConfig } from '../types';
import { DEFAULT_PV_PANEL_CONFIG } from '../constants';

interface PVConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: PVPanelConfig | null;
  onConfirm: (config: PVPanelConfig) => void;
}

export function PVConfigModal({ isOpen, onClose, currentConfig, onConfirm }: PVConfigModalProps) {
  const [width, setWidth] = useState<string>(
    (currentConfig?.width || DEFAULT_PV_PANEL_CONFIG.width).toString()
  );
  const [length, setLength] = useState<string>(
    (currentConfig?.length || DEFAULT_PV_PANEL_CONFIG.length).toString()
  );
  const [wattage, setWattage] = useState<string>(
    (currentConfig?.wattage || DEFAULT_PV_PANEL_CONFIG.wattage).toString()
  );

  const handleConfirm = () => {
    const config: PVPanelConfig = {
      width: parseFloat(width) || DEFAULT_PV_PANEL_CONFIG.width,
      length: parseFloat(length) || DEFAULT_PV_PANEL_CONFIG.length,
      wattage: parseFloat(wattage) || DEFAULT_PV_PANEL_CONFIG.wattage,
    };
    onConfirm(config);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PV Panel Configuration</DialogTitle>
          <DialogDescription>
            Set the dimensions and wattage of your solar panels.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (m)</Label>
              <Input
                id="width"
                type="number"
                step="0.001"
                min="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">Length (m)</Label>
              <Input
                id="length"
                type="number"
                step="0.001"
                min="0.1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="wattage">Wattage (Wp)</Label>
            <Input
              id="wattage"
              type="number"
              step="1"
              min="1"
              value={wattage}
              onChange={(e) => setWattage(e.target.value)}
            />
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            <p>Panel Area: {(parseFloat(width) * parseFloat(length)).toFixed(3)} m²</p>
            <p>Power Density: {(parseFloat(wattage) / (parseFloat(width) * parseFloat(length))).toFixed(1)} W/m²</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
