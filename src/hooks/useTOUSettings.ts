import { useState, useCallback } from "react";
import { TOUSettings, DEFAULT_TOU_SETTINGS } from "@/components/projects/load-profile/types";

const STORAGE_KEY = "tou-settings";

/** Read TOU settings from localStorage (for non-React contexts) */
export function getTOUSettingsFromStorage(): TOUSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TOUSettings;
  } catch {
    // ignore parse errors
  }
  return DEFAULT_TOU_SETTINGS;
}

/** React hook for reading/writing TOU settings */
export function useTOUSettings() {
  const [touSettings, setTouSettings] = useState<TOUSettings>(() => getTOUSettingsFromStorage());

  const updateTOUSettings = useCallback((settings: TOUSettings) => {
    setTouSettings(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, []);

  const resetToDefaults = useCallback(() => {
    setTouSettings(DEFAULT_TOU_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { touSettings, updateTOUSettings, resetToDefaults };
}
