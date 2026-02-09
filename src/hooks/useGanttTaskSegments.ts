import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GanttTaskSegment } from '@/types/gantt';

export function useGanttTaskSegments(projectId: string, taskIds: string[]) {
  const queryClient = useQueryClient();
  const queryKey = ['gantt-task-segments', projectId];

  const { data: segments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      
      const { data, error } = await (supabase
        .from('gantt_task_segments' as any)
        .select('*')
        .in('task_id', taskIds)
        .order('start_date', { ascending: true }) as any);

      if (error) throw error;
      return (data || []) as GanttTaskSegment[];
    },
    enabled: !!projectId && taskIds.length > 0,
  });

  // Build a map: taskId -> segments[]
  const segmentsByTaskId = new Map<string, GanttTaskSegment[]>();
  for (const seg of segments) {
    if (!segmentsByTaskId.has(seg.task_id)) {
      segmentsByTaskId.set(seg.task_id, []);
    }
    segmentsByTaskId.get(seg.task_id)!.push(seg);
  }

  const saveSegments = useMutation({
    mutationFn: async (entries: { task_id: string; start_date: string; end_date: string }[]) => {
      if (entries.length === 0) return;
      const { error } = await (supabase
        .from('gantt_task_segments' as any)
        .insert(entries) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteSegmentsForTasks = useMutation({
    mutationFn: async (taskIdsToDelete: string[]) => {
      if (taskIdsToDelete.length === 0) return;
      const { error } = await (supabase
        .from('gantt_task_segments' as any)
        .delete()
        .in('task_id', taskIdsToDelete) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    segments,
    segmentsByTaskId,
    isLoading,
    saveSegments,
    deleteSegmentsForTasks,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
