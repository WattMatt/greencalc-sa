import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PVPanelConfig } from '../types';
import { DEFAULT_PV_PANEL_CONFIG } from '../constants';
import { Info } from 'lucide-react';

interface PVConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: PVPanelConfig | null;
  moduleName?: string;
}

export function PVConfigModal({ isOpen, onClose, currentConfig, moduleName }: PVConfigModalProps) {
  const config = currentConfig || {
    width: DEFAULT_PV_PANEL_CONFIG.width,
    length: DEFAULT_PV_PANEL_CONFIG.length,
    wattage: DEFAULT_PV_PANEL_CONFIG.wattage,
  };

  const area = config.width * config.length;
  const powerDensity = config.wattage / area;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PV Panel Configuration</DialogTitle>
          <DialogDescription>
            Panel specifications from Simulation tab configuration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Module Info */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Module</Label>
            <p className="font-medium">{moduleName || 'Default Module'}</p>
            <p className="text-xs text-muted-foreground">Source: Simulation Tab</p>
          </div>

          {/* Dimensions Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 bg-muted/50 p-3 rounded-md">
              <Label className="text-muted-foreground text-xs">Width</Label>
              <p className="text-lg font-semibold">{config.width.toFixed(3)} m</p>
            </div>
            <div className="space-y-1 bg-muted/50 p-3 rounded-md">
              <Label className="text-muted-foreground text-xs">Length</Label>
              <p className="text-lg font-semibold">{config.length.toFixed(3)} m</p>
            </div>
          </div>
          
          {/* Wattage */}
          <div className="space-y-1 bg-muted/50 p-3 rounded-md">
            <Label className="text-muted-foreground text-xs">Wattage</Label>
            <p className="text-lg font-semibold">{config.wattage} Wp</p>
          </div>

          {/* Calculated Values */}
          <div className="bg-muted p-3 rounded-md space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Panel Area:</span>{' '}
              <span className="font-medium">{area.toFixed(3)} m²</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Power Density:</span>{' '}
              <span className="font-medium">{powerDensity.toFixed(1)} W/m²</span>
            </p>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              To change panel specifications, go to the <strong>Simulation</strong> tab and update the Solar Module configuration.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
