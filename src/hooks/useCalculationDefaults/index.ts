import { useState, useEffect, useCallback } from "react";
import type { CalculationVariables } from './types';
import {
  DEFAULT_SOLAR_SYSTEM,
  DEFAULT_PVSYST_LOSS,
  DEFAULT_DEGRADATION,
  DEFAULT_FINANCIAL,
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_CARBON,
  DEFAULT_CALCULATION_VARIABLES,
} from './defaults';

// Re-export types
export * from './types';

// Re-export defaults
export {
  DEFAULT_SOLAR_SYSTEM,
  DEFAULT_PVSYST_LOSS,
  DEFAULT_DEGRADATION,
  DEFAULT_FINANCIAL,
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_CARBON,
  DEFAULT_CALCULATION_VARIABLES,
  DEFAULT_CALCULATION_VARIABLES as DEFAULT_CALCULATION_DEFAULTS, // Legacy alias
} from './defaults';

// Re-export utility functions for calculation engines
export {
  getCalculationVariables,
  getSolarSystemVariables,
  getPVsystLossVariables,
  getDegradationVariables,
  getFinancialVariables,
  getCostBreakdownVariables,
  getCarbonVariables,
  buildSystemCostsFromVariables,
  buildPVsystConfigFromVariables,
} from './getCalculationVariables';

const STORAGE_KEY = "calculation-defaults";

/**
 * React hook for managing calculation variables with localStorage persistence
 * Use this in React components that need to read/write calculation settings
 */
export function useCalculationDefaults() {
  const [defaults, setDefaultsState] = useState<CalculationVariables>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Deep merge with defaults to handle new fields
        return {
          solarSystem: { ...DEFAULT_SOLAR_SYSTEM, ...parsed.solarSystem },
          pvsystLoss: { ...DEFAULT_PVSYST_LOSS, ...parsed.pvsystLoss },
          degradation: { ...DEFAULT_DEGRADATION, ...parsed.degradation },
          financial: { ...DEFAULT_FINANCIAL, ...parsed.financial },
          costBreakdown: { ...DEFAULT_COST_BREAKDOWN, ...parsed.costBreakdown },
          carbon: { ...DEFAULT_CARBON, ...parsed.carbon },
        };
      } catch {
        return DEFAULT_CALCULATION_VARIABLES;
      }
    }
    return DEFAULT_CALCULATION_VARIABLES;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }, [defaults]);

  // Update a specific section
  const updateSection = useCallback(<K extends keyof CalculationVariables>(
    section: K,
    updates: Partial<CalculationVariables[K]>
  ) => {
    setDefaultsState(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  }, []);

  // Update a single value
  const updateValue = useCallback(<
    S extends keyof CalculationVariables,
    K extends keyof CalculationVariables[S]
  >(
    section: S,
    key: K,
    value: CalculationVariables[S][K]
  ) => {
    setDefaultsState(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }, []);

  // Reset a section to defaults
  const resetSection = useCallback(<K extends keyof CalculationVariables>(section: K) => {
    const sectionDefaults: Record<keyof CalculationVariables, CalculationVariables[keyof CalculationVariables]> = {
      solarSystem: DEFAULT_SOLAR_SYSTEM,
      pvsystLoss: DEFAULT_PVSYST_LOSS,
      degradation: DEFAULT_DEGRADATION,
      financial: DEFAULT_FINANCIAL,
      costBreakdown: DEFAULT_COST_BREAKDOWN,
      carbon: DEFAULT_CARBON,
    };
    
    setDefaultsState(prev => ({
      ...prev,
      [section]: sectionDefaults[section],
    }));
  }, []);

  // Reset all to defaults
  const resetAll = useCallback(() => {
    setDefaultsState(DEFAULT_CALCULATION_VARIABLES);
  }, []);

  return {
    defaults,
    updateSection,
    updateValue,
    resetSection,
    resetAll,
    // Export individual sections for convenience
    solarSystem: defaults.solarSystem,
    pvsystLoss: defaults.pvsystLoss,
    degradation: defaults.degradation,
    financial: defaults.financial,
    costBreakdown: defaults.costBreakdown,
    carbon: defaults.carbon,
  };
}
