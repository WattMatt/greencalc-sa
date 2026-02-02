import { useState, useCallback, useRef } from 'react';
import { GanttDependencyType } from '@/types/gantt';

interface DependencyDragState {
  sourceTaskId: string;
  sourcePoint: 'start' | 'end';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseDependencyDragOptions {
  onCreateDependency: (predecessorId: string, successorId: string, type: GanttDependencyType) => void;
  onRequestDependencyType?: (predecessorId: string, successorId: string) => void;
}

export function useDependencyDrag({ onCreateDependency, onRequestDependencyType }: UseDependencyDragOptions) {
  const [dragState, setDragState] = useState<DependencyDragState | null>(null);
  const dragRef = useRef<DependencyDragState | null>(null);

  const startDependencyDrag = useCallback((
    taskId: string,
    point: 'start' | 'end',
    clientX: number,
    clientY: number
  ) => {
    const state: DependencyDragState = {
      sourceTaskId: taskId,
      sourcePoint: point,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
    };
    
    dragRef.current = state;
    setDragState(state);
  }, []);

  const updateDependencyDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current) return;

    dragRef.current = {
      ...dragRef.current,
      currentX: clientX,
      currentY: clientY,
    };
    
    setDragState(dragRef.current);
  }, []);

  const endDependencyDrag = useCallback((
    targetTaskId: string | null,
    targetPoint: 'start' | 'end' | null
  ) => {
    if (!dragRef.current || !targetTaskId || !targetPoint) {
      cancelDependencyDrag();
      return;
    }

    const source = dragRef.current;
    
    // Don't allow self-dependency
    if (source.sourceTaskId === targetTaskId) {
      cancelDependencyDrag();
      return;
    }

    // If callback for type selection is provided, use that instead
    if (onRequestDependencyType) {
      onRequestDependencyType(source.sourceTaskId, targetTaskId);
      cancelDependencyDrag();
      return;
    }

    // Determine dependency type based on connection points
    let dependencyType: GanttDependencyType;
    
    if (source.sourcePoint === 'end' && targetPoint === 'start') {
      dependencyType = 'finish_to_start';
    } else if (source.sourcePoint === 'start' && targetPoint === 'start') {
      dependencyType = 'start_to_start';
    } else if (source.sourcePoint === 'end' && targetPoint === 'end') {
      dependencyType = 'finish_to_finish';
    } else {
      dependencyType = 'start_to_finish';
    }

    onCreateDependency(source.sourceTaskId, targetTaskId, dependencyType);
    cancelDependencyDrag();
  }, [onCreateDependency, onRequestDependencyType]);

  const cancelDependencyDrag = useCallback(() => {
    dragRef.current = null;
    setDragState(null);
  }, []);

  return {
    isDraggingDependency: !!dragState,
    dependencyDragState: dragState,
    startDependencyDrag,
    updateDependencyDrag,
    endDependencyDrag,
    cancelDependencyDrag,
  };
}
