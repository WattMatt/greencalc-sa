/**
 * SimulationChartTabs - Chart visualization tabs
 *
 * Displays Building, Load, Grid, PV, Battery, Load Shedding, and Data Comparison
 * chart tabs. Extracted from SimulationPanel.tsx to reduce monolith size.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cloud, Zap } from "lucide-react";

import { LoadChart } from "../load-profile/charts/LoadChart";
import { BuildingProfileChart } from "../load-profile/charts/BuildingProfileChart";
import { SolarChart } from "../load-profile/charts/SolarChart";
import { GridFlowChart } from "../load-profile/charts/GridFlowChart";
import { BatteryChart } from "../load-profile/charts/BatteryChart";
import { TOULegend } from "../load-profile/components/TOULegend";
import { DayNavigationHeader } from "./DayNavigationHeader";
import { LoadSheddingAnalysisPanel } from "./LoadSheddingAnalysisPanel";
import { DataComparisonTab } from "./DataComparisonTab";
import type { ChartDataPoint, TOUPeriod as LoadProfileTOUPeriod } from "../load-profile/types";
import type { AnnualEnergySimulationResults } from "./EnergySimulationEngine";
import type { FinancialResults } from "./FinancialAnalysis";

interface DayDateInfo {
  dayLabel: string;
  dayName: string;
  dayOfWeek: number;
  month: number;
  dayTypeName: string;
  dayNumber: number;
}

interface SimulationChartTabsProps {
  showAnnualAverage: boolean;
  setShowAnnualAverage: (v: boolean) => void;
  selectedDayIndex: number;
  setSelectedDayIndex: (v: number) => void;
  navigateDayIndex: (dir: "prev" | "next") => void;
  dayDateInfo: DayDateInfo;
  simulationChartData: ChartDataPoint[];
  loadProfileIsWeekend: boolean;
  touPeriodsForDay: LoadProfileTOUPeriod[] | undefined;
  dcAcRatio: number;
  maxPvAcKva: number;
  includesBattery: boolean;
  batteryCapacity: number;
  batteryAcCapacity: number;
  batteryChargePower: number;
  loadProfile: number[];
  solarProfile: number[];
  energyConfig: any;
  tariffRate: number;
  comparisonTabViewed: boolean;
  setComparisonTabViewed: (v: boolean) => void;
  solarProfileSolcast: number[] | null;
  solarProfileGeneric: number[];
  annualEnergyResultsGeneric: AnnualEnergySimulationResults | null;
  annualEnergyResultsSolcast: AnnualEnergySimulationResults | null;
  financialResultsGeneric: FinancialResults;
  financialResultsSolcast: FinancialResults | null;
  hasFinancialData: boolean;
  selectedLocationName: string;
}

export function SimulationChartTabs({
  showAnnualAverage, setShowAnnualAverage,
  selectedDayIndex, setSelectedDayIndex, navigateDayIndex, dayDateInfo,
  simulationChartData, loadProfileIsWeekend, touPeriodsForDay,
  dcAcRatio, maxPvAcKva,
  includesBattery, batteryCapacity, batteryAcCapacity, batteryChargePower,
  loadProfile, solarProfile, energyConfig, tariffRate,
  comparisonTabViewed, setComparisonTabViewed,
  solarProfileSolcast, solarProfileGeneric,
  annualEnergyResultsGeneric, annualEnergyResultsSolcast,
  financialResultsGeneric, financialResultsSolcast,
  hasFinancialData, selectedLocationName,
}: SimulationChartTabsProps) {
  const dayNavProps = { showAnnualAverage, setShowAnnualAverage, selectedDayIndex, setSelectedDayIndex, navigateDayIndex, dayDateInfo };
  const commonChartProps = { showTOU: !showAnnualAverage, isWeekend: loadProfileIsWeekend, unit: "kW" as const, touPeriodsOverride: touPeriodsForDay, month: dayDateInfo.month, dayOfWeek: dayDateInfo.dayOfWeek };

  return (
    <Tabs defaultValue="building" onValueChange={(v) => { if (v === 'compare') setComparisonTabViewed(true); }}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="building">Building Profile</TabsTrigger>
        <TabsTrigger value="load">Load Profile</TabsTrigger>
        <TabsTrigger value="grid">Grid Profile</TabsTrigger>
        <TabsTrigger value="pv">PV Profile</TabsTrigger>
        {includesBattery && batteryCapacity > 0 && <TabsTrigger value="battery">Battery Profile</TabsTrigger>}
        <TabsTrigger value="loadshed" className="gap-1"><Zap className="h-3 w-3" />Load Shedding</TabsTrigger>
        {solarProfileSolcast && <TabsTrigger value="compare" className="gap-1"><Cloud className="h-3 w-3" />Data Comparison</TabsTrigger>}
      </TabsList>

      <TabsContent value="building" className="mt-4">
        <Card>
          <CardHeader className="pb-3"><DayNavigationHeader {...dayNavProps} /></CardHeader>
          <CardContent className="space-y-4">
            <BuildingProfileChart chartData={simulationChartData} {...commonChartProps} includesBattery={includesBattery && batteryCapacity > 0} />
            {!showAnnualAverage && <TOULegend />}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="load" className="mt-4">
        <Card>
          <CardHeader className="pb-3"><DayNavigationHeader {...dayNavProps} /></CardHeader>
          <CardContent className="space-y-4">
            <LoadChart chartData={simulationChartData} {...commonChartProps} />
            {!showAnnualAverage && <TOULegend />}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="grid" className="mt-4">
        <Card>
          <CardHeader className="pb-3"><DayNavigationHeader {...dayNavProps} /></CardHeader>
          <CardContent className="space-y-4">
            <GridFlowChart chartData={simulationChartData} {...commonChartProps} />
            {!showAnnualAverage && <TOULegend />}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pv" className="mt-4">
        <Card>
          <CardHeader className="pb-3"><DayNavigationHeader {...dayNavProps} /></CardHeader>
          <CardContent className="space-y-4">
            <SolarChart chartData={simulationChartData} showTOU={!showAnnualAverage} isWeekend={false} dcAcRatio={dcAcRatio} show1to1Comparison={dcAcRatio > 1} unit="kW" maxPvAcKva={maxPvAcKva} touPeriodsOverride={touPeriodsForDay} month={dayDateInfo.month} dayOfWeek={dayDateInfo.dayOfWeek} />
            {!showAnnualAverage && <TOULegend />}
          </CardContent>
        </Card>
      </TabsContent>

      {includesBattery && batteryCapacity > 0 && (
        <TabsContent value="battery" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><DayNavigationHeader {...dayNavProps} /></CardHeader>
            <CardContent className="space-y-4">
              <BatteryChart chartData={simulationChartData} batteryCapacity={batteryCapacity} batteryAcCapacity={batteryAcCapacity} batteryPower={batteryChargePower} {...commonChartProps} />
              {!showAnnualAverage && <TOULegend />}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="loadshed" className="mt-4">
        <LoadSheddingAnalysisPanel loadProfile={loadProfile} solarProfile={solarProfile} config={energyConfig} tariffRate={tariffRate} />
      </TabsContent>

      {annualEnergyResultsSolcast && annualEnergyResultsGeneric && solarProfileSolcast && (
        <TabsContent value="compare" className="mt-4">
          <DataComparisonTab
            solarProfileSolcast={solarProfileSolcast} solarProfileGeneric={solarProfileGeneric}
            annualEnergyResultsGeneric={annualEnergyResultsGeneric} annualEnergyResultsSolcast={annualEnergyResultsSolcast}
            financialResultsGeneric={financialResultsGeneric} financialResultsSolcast={financialResultsSolcast}
            hasFinancialData={hasFinancialData} selectedLocationName={selectedLocationName}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
