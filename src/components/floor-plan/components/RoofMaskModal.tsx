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
import { cn } from '@/lib/utils';

interface RoofMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: number;
  onConfirm: (pitch: number, direction: number) => void;
  // For editing existing roof masks
  initialPitch?: number;
  initialDirection?: number;
  isEditing?: boolean;
}

const DIRECTIONS = [
  { label: 'N', value: 0, rotation: 0 },
  { label: 'NE', value: 45, rotation: 45 },
  { label: 'E', value: 90, rotation: 90 },
  { label: 'SE', value: 135, rotation: 135 },
  { label: 'S', value: 180, rotation: 180 },
  { label: 'SW', value: 225, rotation: 225 },
  { label: 'W', value: 270, rotation: 270 },
  { label: 'NW', value: 315, rotation: 315 },
];

export function RoofMaskModal({ 
  isOpen, 
  onClose, 
  area, 
  onConfirm,
  initialPitch = 15,
  initialDirection = 0,
  isEditing = false,
}: RoofMaskModalProps) {
  const [pitch, setPitch] = useState<number>(initialPitch);
  const [direction, setDirection] = useState<number>(initialDirection);

  // Reset values when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setPitch(initialPitch);
      setDirection(initialDirection);
    }
  }, [isOpen, initialPitch, initialDirection]);

  const handleConfirm = () => {
    onConfirm(pitch, direction);
  };

  const selectedDir = DIRECTIONS.find(d => d.value === direction);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Roof Configuration' : 'Roof Configuration'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the pitch (slope) and direction of this roof section.'
              : 'Set the pitch (slope) and direction of this roof section.'
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

          {/* Direction Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Slope Direction</Label>
              <span className="font-medium">{selectedDir?.label} ({direction}°)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select the direction the roof slopes down toward (water runoff direction)
            </p>
            
            {/* Compass-style direction picker */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                {/* Center indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="w-8 h-8 flex items-center justify-center text-primary"
                    style={{ transform: `rotate(${direction}deg)` }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L8 10h8L12 2z" />
                      <path d="M12 22V10" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                
                {/* Direction buttons arranged in a circle */}
                {DIRECTIONS.map((dir) => {
                  const angle = (dir.rotation - 90) * (Math.PI / 180); // -90 to put N at top
                  const radius = 60;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  
                  return (
                    <button
                      key={dir.value}
                      type="button"
                      onClick={() => setDirection(dir.value)}
                      className={cn(
                        "absolute w-8 h-8 rounded-full text-xs font-medium transition-colors",
                        "flex items-center justify-center",
                        direction === dir.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      )}
                      style={{
                        left: `calc(50% + ${x}px - 16px)`,
                        top: `calc(50% + ${y}px - 16px)`,
                      }}
                    >
                      {dir.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>{isEditing ? 'Update' : 'Confirm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
