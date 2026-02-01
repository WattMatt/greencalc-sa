import { useState, useCallback } from 'react';
import { UndoAction } from '@/types/gantt';

const MAX_HISTORY = 50;

export function useUndoRedo() {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const pushAction = useCallback((action: UndoAction) => {
    setUndoStack((prev) => {
      const newStack = [...prev, action];
      if (newStack.length > MAX_HISTORY) {
        return newStack.slice(-MAX_HISTORY);
      }
      return newStack;
    });
    // Clear redo stack when new action is pushed
    setRedoStack([]);
  }, []);

  const undo = useCallback((): UndoAction | null => {
    if (undoStack.length === 0) return null;

    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);
    return action;
  }, [undoStack]);

  const redo = useCallback((): UndoAction | null => {
    if (redoStack.length === 0) return null;

    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);
    return action;
  }, [redoStack]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    pushAction,
    undo,
    redo,
    clear,
  };
}
