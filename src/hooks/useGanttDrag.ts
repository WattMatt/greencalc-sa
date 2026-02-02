import { useState, useCallback, useRef } from 'react';
import { GanttTask } from '@/types/gantt';
import { differenceInDays, addDays, parseISO, format } from 'date-fns';

export type DragMode = 'move' | 'resize-start' | 'resize-end' | null;

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  originalStartDate: Date;
  originalEndDate: Date;
  currentStartDate: Date;
  currentEndDate: Date;
}

interface UseGanttDragOptions {
  dayWidth: number;
  onUpdateTask: (id: string, updates: Partial<Pick<GanttTask, 'start_date' | 'end_date'>>) => void;
}

export function useGanttDrag({ dayWidth, onUpdateTask }: UseGanttDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const startDrag = useCallback((
    task: GanttTask,
    mode: DragMode,
    clientX: number
  ) => {
    const state: DragState = {
      taskId: task.id,
      mode,
      startX: clientX,
      originalStartDate: parseISO(task.start_date),
      originalEndDate: parseISO(task.end_date),
      currentStartDate: parseISO(task.start_date),
      currentEndDate: parseISO(task.end_date),
    };
    
    dragRef.current = state;
    setDragState(state);
    setIsDragging(true);
  }, []);

  const updateDrag = useCallback((clientX: number) => {
    if (!dragRef.current) return;

    const state = dragRef.current;
    const deltaX = clientX - state.startX;
    const deltaDays = Math.round(deltaX / dayWidth);

    let newStartDate = state.originalStartDate;
    let newEndDate = state.originalEndDate;

    switch (state.mode) {
      case 'move':
        newStartDate = addDays(state.originalStartDate, deltaDays);
        newEndDate = addDays(state.originalEndDate, deltaDays);
        break;
      case 'resize-start':
        newStartDate = addDays(state.originalStartDate, deltaDays);
        // Ensure start doesn't go past end
        if (newStartDate >= state.originalEndDate) {
          newStartDate = addDays(state.originalEndDate, -1);
        }
        break;
      case 'resize-end':
        newEndDate = addDays(state.originalEndDate, deltaDays);
        // Ensure end doesn't go before start
        if (newEndDate <= state.originalStartDate) {
          newEndDate = addDays(state.originalStartDate, 1);
        }
        break;
    }

    dragRef.current = {
      ...state,
      currentStartDate: newStartDate,
      currentEndDate: newEndDate,
    };
    
    setDragState(dragRef.current);
  }, [dayWidth]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;

    const state = dragRef.current;
    const updates: Partial<Pick<GanttTask, 'start_date' | 'end_date'>> = {};
    
    if (state.currentStartDate.getTime() !== state.originalStartDate.getTime()) {
      updates.start_date = format(state.currentStartDate, 'yyyy-MM-dd');
    }
    if (state.currentEndDate.getTime() !== state.originalEndDate.getTime()) {
      updates.end_date = format(state.currentEndDate, 'yyyy-MM-dd');
    }

    // Only update if something changed
    if (Object.keys(updates).length > 0) {
      onUpdateTask(state.taskId, updates);
    }

    dragRef.current = null;
    setDragState(null);
    setIsDragging(false);
  }, [onUpdateTask]);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    setDragState(null);
    setIsDragging(false);
  }, []);

  // Get preview position for a dragging task
  const getDragPreview = useCallback((taskId: string) => {
    if (!dragState || dragState.taskId !== taskId) return null;
    
    return {
      startDate: dragState.currentStartDate,
      endDate: dragState.currentEndDate,
    };
  }, [dragState]);

  return {
    isDragging,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    getDragPreview,
  };
}
