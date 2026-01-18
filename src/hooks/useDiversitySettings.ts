import { useState, useEffect } from "react";

const STORAGE_KEY = "diversity-settings";

export interface DiversitySettings {
  diversityFactor: number;
  buildingType: string | null;
  customProfiles: { name: string; value: number }[];
}

const defaultSettings: DiversitySettings = {
  diversityFactor: 0.80,
  buildingType: "Shopping Centre",
  customProfiles: [],
};

export function useDiversitySettings() {
  const [settings, setSettingsState] = useState<DiversitySettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof DiversitySettings>(
    key: K,
    value: DiversitySettings[K]
  ) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomProfile = (name: string, value: number) => {
    setSettingsState((prev) => ({
      ...prev,
      customProfiles: [...prev.customProfiles, { name, value }],
    }));
  };

  const removeCustomProfile = (index: number) => {
    setSettingsState((prev) => ({
      ...prev,
      customProfiles: prev.customProfiles.filter((_, i) => i !== index),
    }));
  };

  const resetToDefaults = () => {
    setSettingsState({ ...defaultSettings, customProfiles: settings.customProfiles });
  };

  return {
    settings,
    updateSetting,
    addCustomProfile,
    removeCustomProfile,
    resetToDefaults,
    defaultSettings,
  };
}
