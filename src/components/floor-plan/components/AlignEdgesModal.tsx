import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd } from 'lucide-react';

export type AlignmentEdge = 'left' | 'right' | 'top' | 'bottom';

interface AlignEdgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  object1Label: string;
  object2Label: string;
  onConfirm: (edge: AlignmentEdge) => void;
}

export function AlignEdgesModal({
  isOpen,
  onClose,
  object1Label,
  object2Label,
  onConfirm,
}: AlignEdgesModalProps) {
  const [selectedEdge, setSelectedEdge] = useState<AlignmentEdge>('left');

  const handleConfirm = () => {
    onConfirm(selectedEdge);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Align Edges</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>{object1Label}</strong> will move to align with <strong>{object2Label}</strong></p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Select edge to align:</Label>
            <RadioGroup
              value={selectedEdge}
              onValueChange={(value) => setSelectedEdge(value as AlignmentEdge)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="left" id="left" />
                <Label htmlFor="left" className="flex items-center gap-2 cursor-pointer">
                  <AlignHorizontalJustifyStart className="h-4 w-4" />
                  Left edges
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="right" id="right" />
                <Label htmlFor="right" className="flex items-center gap-2 cursor-pointer">
                  <AlignHorizontalJustifyEnd className="h-4 w-4" />
                  Right edges
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="top" id="top" />
                <Label htmlFor="top" className="flex items-center gap-2 cursor-pointer">
                  <AlignVerticalJustifyStart className="h-4 w-4" />
                  Top edges
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="bottom" id="bottom" />
                <Label htmlFor="bottom" className="flex items-center gap-2 cursor-pointer">
                  <AlignVerticalJustifyEnd className="h-4 w-4" />
                  Bottom edges
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {selectedEdge === 'left' || selectedEdge === 'right' 
              ? 'Object will move horizontally'
              : 'Object will move vertically'
            }
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Align
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
