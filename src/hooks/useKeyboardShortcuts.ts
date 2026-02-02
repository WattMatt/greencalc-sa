import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    for (const shortcut of shortcutsRef.current) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Helper to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  if (shortcut.shift) {
    parts.push('⇧');
  }
  
  // Format special keys
  const keyMap: Record<string, string> = {
    'escape': 'Esc',
    'delete': 'Del',
    'backspace': '⌫',
    'enter': '↵',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
  };
  
  const formattedKey = keyMap[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase();
  parts.push(formattedKey);
  
  return parts.join(' + ');
}

// Default Gantt shortcuts
export function getDefaultGanttShortcuts(actions: {
  onNewTask: () => void;
  onNewMilestone: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFocusSearch: () => void;
}): KeyboardShortcut[] {
  return [
    {
      key: 'n',
      description: 'New task',
      action: actions.onNewTask,
    },
    {
      key: 'm',
      description: 'New milestone',
      action: actions.onNewMilestone,
    },
    {
      key: 'Delete',
      description: 'Delete selected',
      action: actions.onDelete,
    },
    {
      key: 'Backspace',
      description: 'Delete selected',
      action: actions.onDelete,
    },
    {
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: actions.onUndo,
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo',
      action: actions.onRedo,
    },
    {
      key: 'y',
      ctrl: true,
      description: 'Redo',
      action: actions.onRedo,
    },
    {
      key: 'a',
      ctrl: true,
      description: 'Select all',
      action: actions.onSelectAll,
    },
    {
      key: 'Escape',
      description: 'Clear selection',
      action: actions.onEscape,
    },
    {
      key: '+',
      ctrl: true,
      description: 'Zoom in',
      action: actions.onZoomIn,
    },
    {
      key: '-',
      ctrl: true,
      description: 'Zoom out',
      action: actions.onZoomOut,
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Focus search',
      action: actions.onFocusSearch,
    },
  ];
}
