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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface RoofMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: number;
  onConfirm: (pitch: number) => void;
  onEditDirection?: () => void;
  initialPitch?: number;
  isEditing?: boolean;
}

export function RoofMaskModal({ 
  isOpen, 
  onClose, 
  area, 
  onConfirm,
  onEditDirection,
  initialPitch = 15,
  isEditing = false,
}: RoofMaskModalProps) {
  const [pitch, setPitch] = useState<number>(initialPitch);

  // Reset values when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setPitch(initialPitch);
    }
  }, [isOpen, initialPitch]);

  const handleConfirm = () => {
    onConfirm(pitch);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Roof Pitch' : 'Roof Configuration'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the pitch (slope) of this roof section.'
              : 'Set the pitch (slope) of this roof section. After confirming, you\'ll draw a line to indicate the slope direction.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-muted p-3 rounded-md text-sm">
            <p>Roof Area: <span className="font-medium">{area.toFixed(1)} m²</span></p>
          </div>
          
          {/* Pitch Slider */}
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

          {!isEditing && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Next step:</strong> After confirming, draw a line on the roof to indicate the slope direction (from high point to low point).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {isEditing && onEditDirection && (
            <Button variant="outline" onClick={onEditDirection}>
              Edit Direction
            </Button>
          )}
          <Button onClick={handleConfirm}>
            {isEditing ? 'Update' : 'Confirm & Draw Direction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
