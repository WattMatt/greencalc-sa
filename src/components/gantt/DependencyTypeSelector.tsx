import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GanttDependencyType } from '@/types/gantt';
import { ArrowRight, ArrowDown, ArrowUp, ArrowLeft } from 'lucide-react';

interface DependencyTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predecessorName: string;
  successorName: string;
  onConfirm: (type: GanttDependencyType) => void;
}

const DEPENDENCY_TYPES: { value: GanttDependencyType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'finish_to_start',
    label: 'Finish to Start (FS)',
    description: 'Task B cannot start until Task A finishes',
    icon: <ArrowRight className="h-4 w-4" />,
  },
  {
    value: 'start_to_start',
    label: 'Start to Start (SS)',
    description: 'Task B cannot start until Task A starts',
    icon: <ArrowDown className="h-4 w-4" />,
  },
  {
    value: 'finish_to_finish',
    label: 'Finish to Finish (FF)',
    description: 'Task B cannot finish until Task A finishes',
    icon: <ArrowUp className="h-4 w-4" />,
  },
  {
    value: 'start_to_finish',
    label: 'Start to Finish (SF)',
    description: 'Task B cannot finish until Task A starts',
    icon: <ArrowLeft className="h-4 w-4" />,
  },
];

export function DependencyTypeSelector({
  open,
  onOpenChange,
  predecessorName,
  successorName,
  onConfirm,
}: DependencyTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<GanttDependencyType>('finish_to_start');

  const handleConfirm = () => {
    onConfirm(selectedType);
    onOpenChange(false);
    setSelectedType('finish_to_start'); // Reset for next use
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Dependency</DialogTitle>
          <DialogDescription>
            Link "{predecessorName}" → "{successorName}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Label className="text-sm font-medium mb-3 block">Dependency Type</Label>
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as GanttDependencyType)}
            className="space-y-3"
          >
            {DEPENDENCY_TYPES.map((type) => (
              <div
                key={type.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedType(type.value)}
              >
                <RadioGroupItem value={type.value} id={type.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{type.icon}</span>
                    <Label htmlFor={type.value} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Create Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
