import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GanttTaskDependency, GanttDependencyType } from '@/types/gantt';
import { toast } from 'sonner';

export function useGanttDependencies(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['gantt-dependencies', projectId];

  const { data: dependencies = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // Get all task IDs for this project first
      const { data: tasks, error: tasksError } = await supabase
        .from('gantt_tasks')
        .select('id')
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;
      if (!tasks || tasks.length === 0) return [];

      const taskIds = tasks.map((t) => t.id);

      // Get dependencies where both predecessor and successor are in this project
      const { data, error } = await supabase
        .from('gantt_task_dependencies')
        .select('*')
        .in('predecessor_id', taskIds);

      if (error) throw error;
      return (data as GanttTaskDependency[]).filter((d) => taskIds.includes(d.successor_id));
    },
    enabled: !!projectId,
  });

  const createDependency = useMutation({
    mutationFn: async ({
      predecessorId,
      successorId,
      dependencyType,
    }: {
      predecessorId: string;
      successorId: string;
      dependencyType: GanttDependencyType;
    }) => {
      const { data, error } = await supabase
        .from('gantt_task_dependencies')
        .insert({
          predecessor_id: predecessorId,
          successor_id: successorId,
          dependency_type: dependencyType,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GanttTaskDependency;
    },
    onSuccess: (newDep) => {
      queryClient.setQueryData(queryKey, (old: GanttTaskDependency[] = []) => [...old, newDep]);
      toast.success('Dependency created');
    },
    onError: (err) => {
      toast.error('Failed to create dependency: ' + (err as Error).message);
    },
  });

  const updateDependency = useMutation({
    mutationFn: async ({
      id,
      dependencyType,
    }: {
      id: string;
      dependencyType: GanttDependencyType;
    }) => {
      const { data, error } = await supabase
        .from('gantt_task_dependencies')
        .update({ dependency_type: dependencyType })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as GanttTaskDependency;
    },
    onSuccess: (updatedDep) => {
      queryClient.setQueryData(queryKey, (old: GanttTaskDependency[] = []) =>
        old.map((d) => (d.id === updatedDep.id ? updatedDep : d))
      );
    },
    onError: (err) => {
      toast.error('Failed to update dependency: ' + (err as Error).message);
    },
  });

  const deleteDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      const { error } = await supabase
        .from('gantt_task_dependencies')
        .delete()
        .eq('id', dependencyId);

      if (error) throw error;
      return dependencyId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(queryKey, (old: GanttTaskDependency[] = []) =>
        old.filter((d) => d.id !== deletedId)
      );
      toast.success('Dependency removed');
    },
    onError: (err) => {
      toast.error('Failed to remove dependency: ' + (err as Error).message);
    },
  });

  return {
    dependencies,
    isLoading,
    error,
    createDependency,
    updateDependency,
    deleteDependency,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
