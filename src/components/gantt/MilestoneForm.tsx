import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GanttMilestone, MilestoneFormData, TASK_COLORS } from '@/types/gantt';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const milestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required'),
  date: z.date(),
  description: z.string(),
  color: z.string().nullable(),
});

interface MilestoneFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: GanttMilestone | null;
  onSubmit: (data: MilestoneFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function MilestoneForm({ open, onOpenChange, milestone, onSubmit, isSubmitting }: MilestoneFormProps) {
  const isEditing = !!milestone;

  const form = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      name: '',
      date: new Date(),
      description: '',
      color: null,
    },
  });

  useEffect(() => {
    if (milestone) {
      form.reset({
        name: milestone.name,
        date: parseISO(milestone.date),
        description: milestone.description || '',
        color: milestone.color,
      });
    } else {
      form.reset({
        name: '',
        date: new Date(),
        description: '',
        color: null,
      });
    }
  }, [milestone, form]);

  const handleSubmit = async (data: MilestoneFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
          <DialogDescription>
            Mark an important date or deliverable in your project schedule.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Milestone Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Equipment Delivery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? format(field.value, 'MMMM d, yyyy') : 'Pick a date'}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Description (optional)" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-full border-2 bg-primary',
                        !field.value ? 'border-foreground' : 'border-transparent'
                      )}
                      onClick={() => field.onChange(null)}
                      title="Default"
                    />
                    {TASK_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={cn(
                          'w-8 h-8 rounded-full border-2',
                          field.value === color.value ? 'border-foreground' : 'border-transparent'
                        )}
                        style={{ backgroundColor: color.value }}
                        onClick={() => field.onChange(color.value)}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Milestone' : 'Add Milestone'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
