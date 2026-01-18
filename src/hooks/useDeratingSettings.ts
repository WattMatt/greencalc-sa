import { useState, useEffect } from "react";

const STORAGE_KEY = "derating-settings";

/**
 * Derating Settings - Applied to PV system simulations over plant lifespan
 * These factors affect solar generation calculations and financial projections
 */
export interface DeratingSettings {
  // PV System Performance Factors
  systemLosses: number;        // Inverter efficiency, wiring, mismatch losses
  dcAcRatio: number;           // Panel oversizing relative to inverter
  temperatureDerating: number; // Output reduction due to heat
  soilingLosses: number;       // Dust/dirt accumulation on panels
  cableLosses: number;         // DC and AC cable power losses
  
  // Electrical System Factors
  powerFactor: number;         // Real vs apparent power ratio
  
  // Annual Degradation
  annualDegradation: number;   // Panel efficiency loss per year
  
  // Legacy - kept for backwards compatibility
  diversityFactor: number;
}

const defaultSettings: DeratingSettings = {
  systemLosses: 0.14,
  powerFactor: 0.95,
  dcAcRatio: 1.2,
  temperatureDerating: 0.05,
  soilingLosses: 0.02,
  cableLosses: 0.02,
  annualDegradation: 0.005, // 0.5% per year
  diversityFactor: 0.85, // Legacy, use useDiversitySettings instead
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

  // Calculate combined derating factor for simulations
  const getCombinedDeratingFactor = () => {
    return (
      (1 - settings.systemLosses) *
      (1 - settings.temperatureDerating) *
      (1 - settings.soilingLosses) *
      (1 - settings.cableLosses)
    );
  };

  return {
    settings,
    updateSetting,
    resetToDefaults,
    defaultSettings,
    getCombinedDeratingFactor,
  };
}
