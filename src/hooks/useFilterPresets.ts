import { useState, useCallback, useEffect } from 'react';
import { GanttFilters, GanttFilterPreset, DEFAULT_FILTERS } from '@/types/gantt';

const STORAGE_KEY = 'gantt-filter-presets';

export function useFilterPresets(projectId: string) {
  const [presets, setPresets] = useState<GanttFilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPresets(parsed);
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
    }
  }, [projectId]);

  // Save presets to localStorage when changed
  const savePresets = useCallback((newPresets: GanttFilterPreset[]) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}-${projectId}`, JSON.stringify(newPresets));
    } catch (error) {
      console.error('Failed to save filter presets:', error);
    }
  }, [projectId]);

  const createPreset = useCallback((name: string, filters: GanttFilters) => {
    const newPreset: GanttFilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters: {
        ...filters,
        // Serialize dates
        dateRange: {
          start: filters.dateRange.start,
          end: filters.dateRange.end,
        },
      },
    };
    
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    
    return newPreset;
  }, [presets, savePresets]);

  const updatePreset = useCallback((id: string, updates: Partial<Pick<GanttFilterPreset, 'name' | 'filters'>>) => {
    const updated = presets.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    setPresets(updated);
    savePresets(updated);
  }, [presets, savePresets]);

  const deletePreset = useCallback((id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    savePresets(updated);
    
    if (activePresetId === id) {
      setActivePresetId(null);
    }
  }, [presets, savePresets, activePresetId]);

  const applyPreset = useCallback((presetId: string): GanttFilters | null => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return null;
    
    setActivePresetId(presetId);
    
    // Deserialize dates
    return {
      ...preset.filters,
      dateRange: {
        start: preset.filters.dateRange.start ? new Date(preset.filters.dateRange.start) : null,
        end: preset.filters.dateRange.end ? new Date(preset.filters.dateRange.end) : null,
      },
    };
  }, [presets]);

  const clearActivePreset = useCallback(() => {
    setActivePresetId(null);
  }, []);

  return {
    presets,
    activePresetId,
    createPreset,
    updatePreset,
    deletePreset,
    applyPreset,
    clearActivePreset,
  };
}
