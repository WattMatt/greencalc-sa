import { useState, useCallback } from "react";
import { ScenarioConfig, ScenarioResults } from "./ScenarioCard";
import { SweepConfig } from "./ParameterSweep";

export interface SandboxState {
  scenarios: {
    id: "A" | "B" | "C";
    config: ScenarioConfig;
    results?: ScenarioResults;
  }[];
  sweepConfig: SweepConfig;
}

const DEFAULT_SCENARIO: ScenarioConfig = {
  solarCapacity: 100,
  batteryCapacity: 0,
  dcAcRatio: 1.3,
};

const DEFAULT_SWEEP: SweepConfig = {
  enabled: false,
  solarMin: 50,
  solarMax: 500,
  solarStep: 50,
  batteryMin: 0,
  batteryMax: 500,
  batteryStep: 100,
  dcAcMin: 100,
  dcAcMax: 150,
  dcAcStep: 10,
};

const SOLAR_COST_PER_KW = 12000;
const BATTERY_COST_PER_KWH = 8000;
const PEAK_SUN_HOURS = 5.5;
const SYSTEM_LOSSES = 0.14;
const TARIFF_RATE = 2.50;

export function useSandboxState() {
  const [history, setHistory] = useState<SandboxState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentState, setCurrentState] = useState<SandboxState>({
    scenarios: [{ id: "A", config: { ...DEFAULT_SCENARIO } }],
    sweepConfig: { ...DEFAULT_SWEEP },
  });

  // Push to history
  const pushHistory = useCallback((newState: SandboxState) => {
    setHistory((prev) => {
      // Remove any "future" states if we're not at the end
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { ...currentState }];
    });
    setHistoryIndex((prev) => prev + 1);
    setCurrentState(newState);
  }, [currentState, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex >= 0) {
      setHistory((prev) => [...prev, { ...currentState }]);
      setCurrentState(history[historyIndex]);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [currentState, history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setCurrentState(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  }, [history, historyIndex]);

  // Update scenario config
  const updateScenario = useCallback((id: "A" | "B" | "C", config: ScenarioConfig) => {
    const newState = {
      ...currentState,
      scenarios: currentState.scenarios.map((s) =>
        s.id === id ? { ...s, config, results: undefined } : s
      ),
    };
    pushHistory(newState);
  }, [currentState, pushHistory]);

  // Add scenario
  const addScenario = useCallback(() => {
    const usedIds = currentState.scenarios.map((s) => s.id);
    const nextId = (["A", "B", "C"] as const).find((id) => !usedIds.includes(id));
    if (!nextId) return;

    const newState = {
      ...currentState,
      scenarios: [
        ...currentState.scenarios,
        { id: nextId, config: { ...DEFAULT_SCENARIO } },
      ],
    };
    pushHistory(newState);
  }, [currentState, pushHistory]);

  // Remove scenario
  const removeScenario = useCallback((id: "A" | "B" | "C") => {
    if (currentState.scenarios.length <= 1) return;
    const newState = {
      ...currentState,
      scenarios: currentState.scenarios.filter((s) => s.id !== id),
    };
    pushHistory(newState);
  }, [currentState, pushHistory]);

  // Update sweep config
  const updateSweepConfig = useCallback((sweepConfig: SweepConfig) => {
    const newState = { ...currentState, sweepConfig };
    pushHistory(newState);
  }, [currentState, pushHistory]);

  // Run simulation
  const runSimulation = useCallback(() => {
    const updatedScenarios = currentState.scenarios.map((scenario) => {
      const { solarCapacity, batteryCapacity, dcAcRatio } = scenario.config;

      // Simple calculation (matches QuickEstimate logic)
      const dailyGeneration = solarCapacity * PEAK_SUN_HOURS * (1 - SYSTEM_LOSSES);
      const annualGeneration = dailyGeneration * 365;
      const selfConsumptionRatio = 0.75; // Simplified
      const selfConsumption = annualGeneration * selfConsumptionRatio;
      const gridImport = 0; // Would need load profile
      const gridExport = annualGeneration - selfConsumption;

      const systemCost =
        solarCapacity * SOLAR_COST_PER_KW + batteryCapacity * BATTERY_COST_PER_KWH;
      const annualSavings = selfConsumption * TARIFF_RATE;
      const paybackYears = systemCost / annualSavings;

      return {
        ...scenario,
        results: {
          annualGeneration,
          selfConsumption,
          gridImport,
          gridExport,
          annualSavings,
          paybackYears,
          systemCost,
        },
      };
    });

    setCurrentState({ ...currentState, scenarios: updatedScenarios });
  }, [currentState]);

  return {
    state: currentState,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,
    undo,
    redo,
    updateScenario,
    addScenario,
    removeScenario,
    updateSweepConfig,
    runSimulation,
  };
}
