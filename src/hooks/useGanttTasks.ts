import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GanttTask, GanttTaskStatus, TaskFormData } from '@/types/gantt';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function useGanttTasks(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['gantt-tasks', projectId];

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gantt_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as GanttTask[];
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (formData: TaskFormData) => {
      // Get max sort order
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.sort_order), 0);

      const { data, error } = await supabase
        .from('gantt_tasks')
        .insert({
          project_id: projectId,
          name: formData.name,
          description: formData.description || null,
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd'),
          status: formData.status,
          owner: formData.owner || null,
          progress: formData.progress,
          color: formData.color,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GanttTask;
    },
    onSuccess: (newTask) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) => [...old, newTask]);
      toast.success('Task created');
    },
    onError: (err) => {
      toast.error('Failed to create task: ' + (err as Error).message);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GanttTask> & { id: string }) => {
      const updateData: Record<string, any> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.owner !== undefined) updateData.owner = updates.owner;
      if (updates.progress !== undefined) updateData.progress = updates.progress;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;

      const { data, error } = await supabase
        .from('gantt_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as GanttTask;
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) =>
        old.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
    },
    onError: (err) => {
      toast.error('Failed to update task: ' + (err as Error).message);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('gantt_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) =>
        old.filter((t) => t.id !== deletedId)
      );
      toast.success('Task deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete task: ' + (err as Error).message);
    },
  });

  const bulkUpdateTasks = useMutation({
    mutationFn: async (updates: { ids: string[]; changes: Partial<Pick<GanttTask, 'status' | 'owner' | 'color' | 'progress'>> }) => {
      const { ids, changes } = updates;
      
      const { error } = await supabase
        .from('gantt_tasks')
        .update(changes)
        .in('id', ids);

      if (error) throw error;
      return { ids, changes };
    },
    onSuccess: ({ ids, changes }) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) =>
        old.map((t) => (ids.includes(t.id) ? { ...t, ...changes } : t))
      );
      toast.success(`Updated ${ids.length} tasks`);
    },
    onError: (err) => {
      toast.error('Failed to update tasks: ' + (err as Error).message);
    },
  });

  const bulkDeleteTasks = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { error } = await supabase
        .from('gantt_tasks')
        .delete()
        .in('id', taskIds);

      if (error) throw error;
      return taskIds;
    },
    onSuccess: (deletedIds) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) =>
        old.filter((t) => !deletedIds.includes(t.id))
      );
      toast.success(`Deleted ${deletedIds.length} tasks`);
    },
    onError: (err) => {
      toast.error('Failed to delete tasks: ' + (err as Error).message);
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update sort_order for each task
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('gantt_tasks')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      return updates;
    },
    onSuccess: (updates) => {
      queryClient.setQueryData(queryKey, (old: GanttTask[] = []) => {
        const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]));
        return [...old]
          .map((t) => ({ ...t, sort_order: orderMap.get(t.id) ?? t.sort_order }))
          .sort((a, b) => a.sort_order - b.sort_order);
      });
    },
    onError: (err) => {
      toast.error('Failed to reorder tasks: ' + (err as Error).message);
    },
  });

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    bulkUpdateTasks,
    bulkDeleteTasks,
    reorderTasks,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
