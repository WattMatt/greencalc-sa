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
import { Slider } from '@/components/ui/slider';

interface RoofMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: number;
  onConfirm: (pitch: number) => void;
}

export function RoofMaskModal({ isOpen, onClose, area, onConfirm }: RoofMaskModalProps) {
  const [pitch, setPitch] = useState<number>(15);

  const handleConfirm = () => {
    onConfirm(pitch);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Roof Configuration</DialogTitle>
          <DialogDescription>
            Set the pitch (slope) of this roof section. After this, you'll need to set the 
            direction by clicking from the highest to lowest point.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-muted p-3 rounded-md text-sm">
            <p>Roof Area: <span className="font-medium">{area.toFixed(1)} m²</span></p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Roof Pitch</Label>
              <span className="font-medium">{pitch}°</span>
            </div>
            <Slider
              value={[pitch]}
              onValueChange={([value]) => setPitch(value)}
              min={0}
              max={45}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              0° = Flat roof, 15-25° = Typical residential, 30-45° = Steep pitch
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Set Pitch & Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
