import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GanttBaseline, GanttBaselineTask, GanttTask } from '@/types/gantt';
import { toast } from 'sonner';

export function useGanttBaselines(projectId: string) {
  const queryClient = useQueryClient();
  const baselinesKey = ['gantt-baselines', projectId];

  const { data: baselines = [], isLoading, error } = useQuery({
    queryKey: baselinesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gantt_baselines')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GanttBaseline[];
    },
    enabled: !!projectId,
  });

  const createBaseline = useMutation({
    mutationFn: async ({ name, description, tasks }: { name: string; description: string; tasks: GanttTask[] }) => {
      // Create the baseline
      const { data: baseline, error: baselineError } = await supabase
        .from('gantt_baselines')
        .insert({
          project_id: projectId,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (baselineError) throw baselineError;

      // Create baseline tasks (snapshots)
      if (tasks.length > 0) {
        const baselineTasks = tasks.map((task) => ({
          baseline_id: baseline.id,
          task_id: task.id,
          name: task.name,
          start_date: task.start_date,
          end_date: task.end_date,
        }));

        const { error: tasksError } = await supabase
          .from('gantt_baseline_tasks')
          .insert(baselineTasks);

        if (tasksError) throw tasksError;
      }

      return baseline as GanttBaseline;
    },
    onSuccess: (newBaseline) => {
      queryClient.setQueryData(baselinesKey, (old: GanttBaseline[] = []) => [newBaseline, ...old]);
      toast.success('Baseline saved');
    },
    onError: (err) => {
      toast.error('Failed to save baseline: ' + (err as Error).message);
    },
  });

  const deleteBaseline = useMutation({
    mutationFn: async (baselineId: string) => {
      const { error } = await supabase
        .from('gantt_baselines')
        .delete()
        .eq('id', baselineId);

      if (error) throw error;
      return baselineId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(baselinesKey, (old: GanttBaseline[] = []) =>
        old.filter((b) => b.id !== deletedId)
      );
      toast.success('Baseline deleted');
    },
    onError: (err) => {
      toast.error('Failed to delete baseline: ' + (err as Error).message);
    },
  });

  return {
    baselines,
    isLoading,
    error,
    createBaseline,
    deleteBaseline,
    refetch: () => queryClient.invalidateQueries({ queryKey: baselinesKey }),
  };
}

// Separate hook for fetching baseline task snapshots
export function useBaselineTasks(baselineId: string | null) {
  return useQuery({
    queryKey: ['gantt-baseline-tasks', baselineId],
    queryFn: async () => {
      if (!baselineId) return [];
      
      const { data, error } = await supabase
        .from('gantt_baseline_tasks')
        .select('*')
        .eq('baseline_id', baselineId);

      if (error) throw error;
      return data as GanttBaselineTask[];
    },
    enabled: !!baselineId,
  });
}
