import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DimensionInput } from './DimensionInput';
import { MoveHorizontal, ArrowRight } from 'lucide-react';

interface SetDistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDistance: number; // in meters
  object1Label: string;
  object2Label: string;
  onConfirm: (newDistance: number) => void;
}

export function SetDistanceModal({
  isOpen,
  onClose,
  currentDistance,
  object1Label,
  object2Label,
  onConfirm,
}: SetDistanceModalProps) {
  const [newDistance, setNewDistance] = useState(currentDistance);

  // Update local state when modal opens with new distance
  useEffect(() => {
    if (isOpen) {
      setNewDistance(currentDistance);
    }
  }, [isOpen, currentDistance]);

  const handleConfirm = () => {
    if (newDistance >= 0) {
      onConfirm(newDistance);
      onClose();
    }
  };

  const distanceChange = newDistance - currentDistance;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Set Distance Between Objects
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Objects info */}
          <div className="flex items-center justify-center gap-3 text-sm">
            <div className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded font-medium dark:bg-blue-900 dark:text-blue-200">
              {object1Label}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="px-3 py-1.5 bg-green-100 text-green-800 rounded font-medium dark:bg-green-900 dark:text-green-200">
              {object2Label}
            </div>
          </div>

          {/* Current distance */}
          <div className="text-center text-sm text-muted-foreground">
            Current distance: <span className="font-medium text-foreground">{currentDistance.toFixed(2)}m</span>
          </div>

          {/* New distance input */}
          <div className="space-y-2">
            <DimensionInput
              label="New Distance"
              value={newDistance}
              onChange={setNewDistance}
            />
          </div>

          {/* Preview of change */}
          {distanceChange !== 0 && (
            <div className={`text-sm text-center p-2 rounded ${
              distanceChange > 0 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
            }`}>
              {object1Label} will move {Math.abs(distanceChange).toFixed(2)}m {distanceChange > 0 ? 'away from' : 'toward'} {object2Label}
            </div>
          )}

          {/* Note about which object moves */}
          <p className="text-xs text-muted-foreground text-center">
            <strong>{object1Label}</strong> will be repositioned while <strong>{object2Label}</strong> stays in place.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={newDistance < 0}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
