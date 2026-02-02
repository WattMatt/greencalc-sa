import { useState, useCallback, useRef } from 'react';
import { GanttTask } from '@/types/gantt';

interface ReorderState {
  draggedTaskId: string;
  draggedIndex: number;
  currentIndex: number;
}

interface UseTaskReorderOptions {
  tasks: GanttTask[];
  onReorder: (orderedIds: string[]) => void;
}

export function useTaskReorder({ tasks, onReorder }: UseTaskReorderOptions) {
  const [reorderState, setReorderState] = useState<ReorderState | null>(null);
  const stateRef = useRef<ReorderState | null>(null);

  const startReorder = useCallback((taskId: string) => {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    const state: ReorderState = {
      draggedTaskId: taskId,
      draggedIndex: index,
      currentIndex: index,
    };
    
    stateRef.current = state;
    setReorderState(state);
  }, [tasks]);

  const updateReorder = useCallback((targetIndex: number) => {
    if (!stateRef.current) return;
    
    // Clamp to valid range
    const clampedIndex = Math.max(0, Math.min(targetIndex, tasks.length - 1));
    
    stateRef.current = {
      ...stateRef.current,
      currentIndex: clampedIndex,
    };
    
    setReorderState(stateRef.current);
  }, [tasks.length]);

  const endReorder = useCallback(() => {
    if (!stateRef.current) return;

    const { draggedIndex, currentIndex } = stateRef.current;
    
    // Only reorder if position changed
    if (draggedIndex !== currentIndex) {
      const orderedTasks = [...tasks];
      const [removed] = orderedTasks.splice(draggedIndex, 1);
      orderedTasks.splice(currentIndex, 0, removed);
      
      onReorder(orderedTasks.map(t => t.id));
    }

    stateRef.current = null;
    setReorderState(null);
  }, [tasks, onReorder]);

  const cancelReorder = useCallback(() => {
    stateRef.current = null;
    setReorderState(null);
  }, []);

  // Get reordered task list for preview
  const getReorderedTasks = useCallback(() => {
    if (!reorderState) return tasks;
    
    const { draggedIndex, currentIndex } = reorderState;
    const result = [...tasks];
    const [removed] = result.splice(draggedIndex, 1);
    result.splice(currentIndex, 0, removed);
    
    return result;
  }, [tasks, reorderState]);

  return {
    isReordering: !!reorderState,
    reorderState,
    startReorder,
    updateReorder,
    endReorder,
    cancelReorder,
    getReorderedTasks,
  };
}
