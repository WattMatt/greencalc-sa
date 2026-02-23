import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tenant, ShopType, DAYS_OF_WEEK, DayOfWeek, DisplayUnit, Annotation } from "./types";
import { useLoadProfileData } from "./hooks/useLoadProfileData";
import { useExportHandlers } from "./hooks/useExportHandlers";
import { useSolcastPVProfile } from "./hooks/useSolcastPVProfile";
import { LoadChart } from "./charts/LoadChart";
import { EnvelopeChart } from "./charts/EnvelopeChart";
import { useEnvelopeData } from "./hooks/useEnvelopeData";
import { useRawScadaData } from "./hooks/useRawScadaData";
import { SolarChart } from "./charts/SolarChart";
import { GridFlowChart } from "./charts/GridFlowChart";
import { BatteryChart } from "./charts/BatteryChart";
import { ChartHeader } from "./components/ChartHeader";
import { ChartSettings } from "./components/ChartSettings";
import { ChartStats } from "./components/ChartStats";
import { OverPanelingAnalysis } from "./components/OverPanelingAnalysis";
import { AnnotationsPanel } from "./components/AnnotationsPanel";
import { TOULegend } from "./components/TOULegend";
import { TopContributors } from "./components/TopContributors";
import { MethodologySection, solarMethodology, batteryMethodology, financialMethodology, touMethodology } from "@/components/simulation/MethodologySection";
import { useDeratingSettings } from "@/hooks/useDeratingSettings";
import { useDiversitySettings } from "@/hooks/useDiversitySettings";

interface LoadProfileChartProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  projectId?: string;
  connectionSizeKva?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  // Simulated system parameters from saved simulation
  simulatedSolarCapacityKwp?: number | null;
  simulatedBatteryCapacityKwh?: number | null;
  simulatedBatteryPowerKw?: number | null;
  simulatedDcAcRatio?: number | null;
  // System type flags to control initial toggle states
  systemIncludesSolar?: boolean;
  systemIncludesBattery?: boolean;
}

export function LoadProfileChart({ 
  tenants, 
  shopTypes, 
  projectId,
  connectionSizeKva, 
  latitude, 
  longitude,
  simulatedSolarCapacityKwp,
  simulatedBatteryCapacityKwh,
  simulatedBatteryPowerKw,
  simulatedDcAcRatio,
  systemIncludesSolar = true,
  systemIncludesBattery = false,
}: LoadProfileChartProps) {
  // Fetch raw SCADA data on demand (only when this component is mounted/visible)
  const { rawDataMap } = useRawScadaData({ projectId });

  // Get global settings as defaults - Diversity for load profiles, Derating for PV simulations
  const { settings: globalDeratingSettings } = useDeratingSettings();
  const { settings: globalDiversitySettings } = useDiversitySettings();
  
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kw");
  const [powerFactor, setPowerFactor] = useState(() => globalDeratingSettings.powerFactor);
  // Multi-day selection for average mode (default: Wednesday only)
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set([3])); // 3 = Wednesday (0=Sun)
  // Keep legacy selectedDay for compatibility with other components
  const selectedDay: DayOfWeek = DAYS_OF_WEEK[(Array.from(selectedDays)[0] + 6) % 7] || "Wednesday";
  
  // Toggle states with localStorage persistence
  const [showTOU, setShowTOU] = useState(() => {
    const saved = localStorage.getItem('loadProfile_showTOU');
    return saved !== null ? saved === 'true' : true;
  });
  const [showPVProfile, setShowPVProfile] = useState(() => {
    const saved = localStorage.getItem('loadProfile_showPV');
    return saved !== null ? saved === 'true' : systemIncludesSolar;
  });
  const [showBattery, setShowBattery] = useState(() => {
    const saved = localStorage.getItem('loadProfile_showBattery');
    return saved !== null ? saved === 'true' : systemIncludesBattery;
  });
  
  // Persist toggle states to localStorage
  useEffect(() => {
    localStorage.setItem('loadProfile_showTOU', String(showTOU));
  }, [showTOU]);
  
  useEffect(() => {
    localStorage.setItem('loadProfile_showPV', String(showPVProfile));
  }, [showPVProfile]);
  
  useEffect(() => {
    localStorage.setItem('loadProfile_showBattery', String(showBattery));
  }, [showBattery]);
  // Use simulated battery values if available, otherwise defaults
  const [batteryCapacity, setBatteryCapacity] = useState(() => simulatedBatteryCapacityKwh || 500);
  const [batteryPower, setBatteryPower] = useState(() => simulatedBatteryPowerKw || 250);
  // Use simulated DC/AC ratio if available, otherwise fall back to global settings
  const [dcAcRatio, setDcAcRatio] = useState(() => simulatedDcAcRatio || globalDeratingSettings.dcAcRatio);
  
  // Sync simulated values when they become available (after query loads)
  useEffect(() => {
    if (simulatedDcAcRatio !== undefined && simulatedDcAcRatio !== null) {
      setDcAcRatio(simulatedDcAcRatio);
    }
  }, [simulatedDcAcRatio]);
  
  useEffect(() => {
    if (simulatedBatteryCapacityKwh !== undefined && simulatedBatteryCapacityKwh !== null) {
      setBatteryCapacity(simulatedBatteryCapacityKwh);
    }
  }, [simulatedBatteryCapacityKwh]);
  
  useEffect(() => {
    if (simulatedBatteryPowerKw !== undefined && simulatedBatteryPowerKw !== null) {
      setBatteryPower(simulatedBatteryPowerKw);
    }
  }, [simulatedBatteryPowerKw]);
  const [show1to1Comparison, setShow1to1Comparison] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [systemLosses, setSystemLosses] = useState(() => globalDeratingSettings.systemLosses);
  // Use diversity settings for load profile diversity factor
  const [diversityFactor, setDiversityFactor] = useState(() => globalDiversitySettings.diversityFactor);
  // Month multi-select for average mode filtering (default: all months)
  const [selectedMonthsFilter, setSelectedMonthsFilter] = useState<Set<number>>(
    () => new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  );
  const chartRef = useRef<HTMLDivElement>(null);

  // Maximum possible PV based on connection (for reference)
  const maxPossiblePvKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  
  // Use simulated solar capacity if available, otherwise fall back to maximum possible
  const maxPvAcKva = simulatedSolarCapacityKwp ?? maxPossiblePvKva;
  
  // Get effective DC/AC ratio - prefer simulated value if available
  const effectiveDcAcRatio = simulatedDcAcRatio ?? dcAcRatio;
  
  // Calculate DC capacity using effective ratio
  const dcCapacityKwp = useMemo(() => {
    return maxPvAcKva ? maxPvAcKva * effectiveDcAcRatio : null;
  }, [maxPvAcKva, effectiveDcAcRatio]);

  // Determine if current selection includes only weekend days
  const isWeekendSelection = useMemo(() => {
    const days = Array.from(selectedDays);
    return days.every(d => d === 0 || d === 6);
  }, [selectedDays]);

  // Legacy day index for compatibility
  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const unit = displayUnit === "kw" ? "kW" : "kVA";

  // Navigate day for legacy compatibility (not used in multi-select mode)
  const navigateDay = (direction: "prev" | "next") => {
    const currentDays = Array.from(selectedDays);
    if (currentDays.length === 1) {
      const newIndex = direction === "prev" ? (currentDays[0] - 1 + 7) % 7 : (currentDays[0] + 1) % 7;
      setSelectedDays(new Set([newIndex]));
    }
  };

  // Solcast PV profile hook
  const {
    pvProfile: solcastProfile,
    isLoading: solcastLoading,
    useSolcast,
    toggleSolcast,
    refetch: refetchSolcast,
    hasLocation,
  } = useSolcastPVProfile({
    latitude: latitude || null,
    longitude: longitude || null,
  });

  // Averaged data hook (always used now - no more month/specific modes)
  const {
    chartData,
    totalDaily,
    peakHour,
    avgHourly,
    loadFactor,
    pvStats,
    overPanelingStats,
    tenantsWithScada,
    tenantsEstimated,
    isWeekend,
    weekdayDailyKwh,
    weekendDailyKwh,
    validatedDateCount,
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDays,
    displayUnit,
    powerFactor,
    showPVProfile,
    maxPvAcKva,
    dcCapacityKwp,
    dcAcRatio: effectiveDcAcRatio,
    showBattery,
    batteryCapacity,
    batteryPower,
    solcastProfile: useSolcast ? solcastProfile : undefined,
    systemLosses,
    diversityFactor,
    rawDataMap,
  });

  // Envelope chart data (min/max/avg per hour across all days)
  const {
    envelopeData,
    isComputing: envelopeComputing,
    availableYears,
    yearFrom: envelopeYearFrom,
    yearTo: envelopeYearTo,
    setYearFrom: setEnvelopeYearFrom,
    setYearTo: setEnvelopeYearTo,
  } = useEnvelopeData({ tenants, displayUnit, powerFactor, rawDataMap });

  const { exportToCSV, exportToPDF, exportToPNG, exportToSVG } = useExportHandlers({
    chartData,
    unit,
    showPVProfile,
    showBattery,
    selectedDay,
    isWeekend,
    totalDaily,
    peakHour,
    loadFactor,
    tenantsCount: tenants.length,
    tenantsWithScada,
    tenantsEstimated,
    chartRef,
  });

  if (tenants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">Add tenants to see the combined load profile</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Chart Card */}
      <Card>
        <CardHeader className="pb-3">
          <ChartHeader
            selectedDay={selectedDay}
            isWeekend={isWeekend}
            displayUnit={displayUnit}
            setDisplayUnit={setDisplayUnit}
            navigateDay={navigateDay}
            peakHour={peakHour}
            unit={unit}
            showTOU={showTOU}
            setShowTOU={setShowTOU}
            showPVProfile={showPVProfile}
            setShowPVProfile={setShowPVProfile}
            showBattery={showBattery}
            setShowBattery={setShowBattery}
            showAnnotations={showAnnotations}
            setShowAnnotations={setShowAnnotations}
            maxPvAcKva={maxPvAcKva}
            tenantsWithScada={tenantsWithScada}
            tenantsEstimated={tenantsEstimated}
            exportToCSV={exportToCSV}
            exportToPDF={exportToPDF}
            exportToPNG={exportToPNG}
            exportToSVG={exportToSVG}
            // Weekday multi-select props
            selectedDays={selectedDays}
            onDaysChange={setSelectedDays}
            // Month multi-select props for filtering
            selectedMonthsFilter={selectedMonthsFilter}
            onMonthsFilterChange={setSelectedMonthsFilter}
          />
        </CardHeader>

        <CardContent className="pt-0" ref={chartRef}>
          <ChartSettings
            showAdvancedSettings={showAdvancedSettings}
            setShowAdvancedSettings={setShowAdvancedSettings}
            displayUnit={displayUnit}
            powerFactor={powerFactor}
            setPowerFactor={setPowerFactor}
            showPVProfile={showPVProfile}
            maxPvAcKva={maxPvAcKva}
            dcAcRatio={effectiveDcAcRatio}
            setDcAcRatio={setDcAcRatio}
            dcCapacityKwp={dcCapacityKwp}
            show1to1Comparison={show1to1Comparison}
            setShow1to1Comparison={setShow1to1Comparison}
            showBattery={showBattery}
            batteryCapacity={batteryCapacity}
            setBatteryCapacity={setBatteryCapacity}
            batteryPower={batteryPower}
            setBatteryPower={setBatteryPower}
            // Solcast props
            solcastProfile={solcastProfile}
            useSolcast={useSolcast}
            toggleSolcast={toggleSolcast}
            solcastLoading={solcastLoading}
            refetchSolcast={refetchSolcast}
            hasLocation={hasLocation}
            // System losses
            systemLosses={systemLosses}
            setSystemLosses={setSystemLosses}
            // Diversity factor
            diversityFactor={diversityFactor}
            setDiversityFactor={setDiversityFactor}
            // Preset application callbacks
            setShowPVProfile={setShowPVProfile}
            setShowBattery={setShowBattery}
            setUseSolcast={toggleSolcast}
          />

          {/* Load Profile Chart */}
          <LoadChart chartData={chartData} showTOU={showTOU} isWeekend={isWeekend} unit={unit} />

          {/* Min/Max/Average Envelope Chart */}
          {envelopeComputing ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : envelopeData.length > 0 ? (
            <EnvelopeChart
              envelopeData={envelopeData}
              availableYears={availableYears}
              yearFrom={envelopeYearFrom}
              yearTo={envelopeYearTo}
              setYearFrom={setEnvelopeYearFrom}
              setYearTo={setEnvelopeYearTo}
              unit={unit}
            />
          ) : null}

          {/* PV Generation Chart */}
          {showPVProfile && maxPvAcKva && chartData && (
            <SolarChart
              chartData={chartData}
              showTOU={showTOU}
              isWeekend={isWeekend}
              dcAcRatio={effectiveDcAcRatio}
              show1to1Comparison={show1to1Comparison}
              unit={unit}
              maxPvAcKva={maxPvAcKva}
            />
          )}

          {/* Grid Flow Chart */}
          {showPVProfile && maxPvAcKva && chartData && (
            <GridFlowChart
              chartData={chartData}
              showTOU={showTOU}
              isWeekend={isWeekend}
              unit={unit}
            />
          )}


          {/* Over-Paneling Summary */}
          {showPVProfile && maxPvAcKva && overPanelingStats && effectiveDcAcRatio > 1 && (
            <OverPanelingAnalysis stats={overPanelingStats} dcAcRatio={effectiveDcAcRatio} />
          )}

          {/* Battery Chart */}
          {showBattery && showPVProfile && maxPvAcKva && chartData && (
            <BatteryChart chartData={chartData} batteryCapacity={batteryCapacity} batteryPower={batteryPower} />
          )}

          {/* TOU Legend */}
          {showTOU && <TOULegend />}

          {/* Annotations Panel */}
          {showAnnotations && <AnnotationsPanel annotations={annotations} setAnnotations={setAnnotations} />}
        </CardContent>
      </Card>

      {/* Compact Stats Row */}
      <ChartStats 
        totalDaily={totalDaily} 
        avgHourly={avgHourly} 
        loadFactor={loadFactor} 
        unit={unit} 
        pvStats={pvStats}
        weekdayDailyKwh={weekdayDailyKwh}
        weekendDailyKwh={weekendDailyKwh}
        validatedDateCount={validatedDateCount}
      />

      {/* Top Contributors */}
      <TopContributors tenants={tenants} chartData={chartData} />

      {/* Methodology Section */}
      <MethodologySection 
        items={[
          solarMethodology,
          ...(showBattery ? [batteryMethodology] : []),
          touMethodology,
          financialMethodology,
        ]} 
      />
    </div>
  );
}
