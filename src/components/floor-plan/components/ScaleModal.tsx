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

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixelDistance: number;
  onConfirm: (realDistance: number) => void;
}

export function ScaleModal({ isOpen, onClose, pixelDistance, onConfirm }: ScaleModalProps) {
  const [realDistance, setRealDistance] = useState<string>('');

  const handleConfirm = () => {
    const distance = parseFloat(realDistance);
    if (!isNaN(distance) && distance > 0) {
      onConfirm(distance);
      setRealDistance('');
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
          <div className="space-y-2">
            <Label htmlFor="distance">Real-world distance (meters)</Label>
            <Input
              id="distance"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g., 10.5"
              value={realDistance}
              onChange={(e) => setRealDistance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
          </div>
          
          {realDistance && !isNaN(parseFloat(realDistance)) && parseFloat(realDistance) > 0 && (
            <p className="text-sm text-muted-foreground">
              Scale ratio: {(parseFloat(realDistance) / pixelDistance * 1000).toFixed(2)} mm/pixel
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!realDistance || parseFloat(realDistance) <= 0}>
            Set Scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
