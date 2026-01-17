import { useState, useEffect } from "react";

const STORAGE_KEY = "derating-settings";

export interface DeratingSettings {
  diversityFactor: number;
  systemLosses: number;
  powerFactor: number;
  dcAcRatio: number;
  temperatureDerating: number;
  soilingLosses: number;
  cableLosses: number;
}

const defaultSettings: DeratingSettings = {
  diversityFactor: 0.85,
  systemLosses: 0.14,
  powerFactor: 0.95,
  dcAcRatio: 1.2,
  temperatureDerating: 0.05,
  soilingLosses: 0.02,
  cableLosses: 0.02,
};

export function useDeratingSettings() {
  const [settings, setSettingsState] = useState<DeratingSettings>(() => {
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

  const updateSetting = <K extends keyof DeratingSettings>(
    key: K,
    value: DeratingSettings[K]
  ) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setSettingsState(defaultSettings);
  };

  return {
    settings,
    updateSetting,
    resetToDefaults,
    defaultSettings,
  };
}
