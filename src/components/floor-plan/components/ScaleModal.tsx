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
import { DimensionInput } from './DimensionInput';

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixelDistance: number;
  onConfirm: (realDistance: number) => void;
}

export function ScaleModal({ isOpen, onClose, pixelDistance, onConfirm }: ScaleModalProps) {
  const [realDistance, setRealDistance] = useState<number>(0);

  const handleConfirm = () => {
    if (realDistance > 0) {
      onConfirm(realDistance);
      setRealDistance(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Drawing Scale</DialogTitle>
          <DialogDescription>
            You've drawn a line of {pixelDistance.toFixed(0)} pixels. Enter the real-world 
            length of this line to set the scale for accurate measurements.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <DimensionInput
            label="Real-world distance"
            value={realDistance}
            onChange={setRealDistance}
          />
          
          {realDistance > 0 && (
            <p className="text-sm text-muted-foreground">
              Scale ratio: {(realDistance / pixelDistance * 1000).toFixed(2)} mm/pixel
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={realDistance <= 0}>
            Set Scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
