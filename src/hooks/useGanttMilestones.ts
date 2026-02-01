import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GanttMilestone, MilestoneFormData } from '@/types/gantt';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function useGanttMilestones(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['gantt-milestones', projectId];

  const { data: milestones = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gantt_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: true });

      if (error) throw error;
      return data as GanttMilestone[];
    },
    enabled: !!projectId,
  });

  const createMilestone = useMutation({
    mutationFn: async (formData: MilestoneFormData) => {
      const { data, error } = await supabase
        .from('gantt_milestones')
        .insert({
          project_id: projectId,
          name: formData.name,
          date: format(formData.date, 'yyyy-MM-dd'),
          description: formData.description || null,
          color: formData.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GanttMilestone;
    },
    onSuccess: (newMilestone) => {
      queryClient.setQueryData(queryKey, (old: GanttMilestone[] = []) => 
        [...old, newMilestone].sort((a, b) => a.date.localeCompare(b.date))
      );
      toast.success('Milestone created');
    },
    onError: (err) => {
      toast.error('Failed to create milestone: ' + (err as Error).message);
    },
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GanttMilestone> & { id: string }) => {
      const updateData: Record<string, any> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.color !== undefined) updateData.color = updates.color;

      const { data, error } = await supabase
        .from('gantt_milestones')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as GanttMilestone;
    },
    onSuccess: (updatedMilestone) => {
      queryClient.setQueryData(queryKey, (old: GanttMilestone[] = []) =>
        old.map((m) => (m.id === updatedMilestone.id ? updatedMilestone : m))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
      toast.success('Milestone updated');
    },
    onError: (err) => {
      toast.error('Failed to update milestone: ' + (err as Error).message);
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from('gantt_milestones')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
      return milestoneId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(queryKey, (old: GanttMilestone[] = []) =>
        old.filter((m) => m.id !== deletedId)
      );
      toast.success('Milestone deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete milestone: ' + (err as Error).message);
    },
  });

  return {
    milestones,
    isLoading,
    error,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
