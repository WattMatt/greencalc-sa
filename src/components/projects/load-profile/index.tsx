import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tenant, ShopType, DAYS_OF_WEEK, DayOfWeek, DisplayUnit, Annotation } from "./types";
import { useLoadProfileData } from "./hooks/useLoadProfileData";
import { useExportHandlers } from "./hooks/useExportHandlers";
import { useSolcastPVProfile } from "./hooks/useSolcastPVProfile";
import { LoadChart } from "./charts/LoadChart";
import { EnvelopeChart } from "./charts/EnvelopeChart";
import { useEnvelopeData } from "./hooks/useEnvelopeData";
import { useRawScadaData } from "./hooks/useRawScadaData";
import { useValidatedSiteData } from "./hooks/useValidatedSiteData";
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
  // Fetch raw SCADA data on demand
  const { rawDataMap } = useRawScadaData({ projectId });

  // Shared validated site data — single parse, single validation
  const validatedSiteData = useValidatedSiteData({ tenants, rawDataMap });

  // Get global settings as defaults
  const { settings: globalDeratingSettings } = useDeratingSettings();
  const { settings: globalDiversitySettings } = useDiversitySettings();
  
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kw");
  const [powerFactor, setPowerFactor] = useState(() => globalDeratingSettings.powerFactor);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set([3]));
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
  
  useEffect(() => { localStorage.setItem('loadProfile_showTOU', String(showTOU)); }, [showTOU]);
  useEffect(() => { localStorage.setItem('loadProfile_showPV', String(showPVProfile)); }, [showPVProfile]);
  useEffect(() => { localStorage.setItem('loadProfile_showBattery', String(showBattery)); }, [showBattery]);

  const [batteryCapacity, setBatteryCapacity] = useState(() => simulatedBatteryCapacityKwh || 500);
  const [batteryPower, setBatteryPower] = useState(() => simulatedBatteryPowerKw || 250);
  const [dcAcRatio, setDcAcRatio] = useState(() => simulatedDcAcRatio || globalDeratingSettings.dcAcRatio);
  
  useEffect(() => { if (simulatedDcAcRatio != null) setDcAcRatio(simulatedDcAcRatio); }, [simulatedDcAcRatio]);
  useEffect(() => { if (simulatedBatteryCapacityKwh != null) setBatteryCapacity(simulatedBatteryCapacityKwh); }, [simulatedBatteryCapacityKwh]);
  useEffect(() => { if (simulatedBatteryPowerKw != null) setBatteryPower(simulatedBatteryPowerKw); }, [simulatedBatteryPowerKw]);

  const [show1to1Comparison, setShow1to1Comparison] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [systemLosses, setSystemLosses] = useState(() => globalDeratingSettings.systemLosses);
  const [diversityFactor, setDiversityFactor] = useState(() => globalDiversitySettings.diversityFactor);
  const [selectedMonthsFilter, setSelectedMonthsFilter] = useState<Set<number>>(
    () => new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  );
  const chartRef = useRef<HTMLDivElement>(null);

  const maxPossiblePvKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const maxPvAcKva = simulatedSolarCapacityKwp ?? maxPossiblePvKva;
  const effectiveDcAcRatio = simulatedDcAcRatio ?? dcAcRatio;
  const dcCapacityKwp = useMemo(() => maxPvAcKva ? maxPvAcKva * effectiveDcAcRatio : null, [maxPvAcKva, effectiveDcAcRatio]);

  const isWeekendSelection = useMemo(() => {
    const days = Array.from(selectedDays);
    return days.every(d => d === 0 || d === 6);
  }, [selectedDays]);

  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const unit = displayUnit === "kw" ? "kW" : "kVA";

  const navigateDay = (direction: "prev" | "next") => {
    const currentDays = Array.from(selectedDays);
    if (currentDays.length === 1) {
      const newIndex = direction === "prev" ? (currentDays[0] - 1 + 7) % 7 : (currentDays[0] + 1) % 7;
      setSelectedDays(new Set([newIndex]));
    }
  };

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
    validatedSiteData,
  });

  // Envelope chart data — consumes the same shared dataset
  const {
    envelopeData,
    availableYears,
    yearFrom: envelopeYearFrom,
    yearTo: envelopeYearTo,
    setYearFrom: setEnvelopeYearFrom,
    setYearTo: setEnvelopeYearTo,
  } = useEnvelopeData({ displayUnit, powerFactor, validatedSiteData });

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
            selectedDays={selectedDays}
            onDaysChange={setSelectedDays}
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
            solcastProfile={solcastProfile}
            useSolcast={useSolcast}
            toggleSolcast={toggleSolcast}
            solcastLoading={solcastLoading}
            refetchSolcast={refetchSolcast}
            hasLocation={hasLocation}
            systemLosses={systemLosses}
            setSystemLosses={setSystemLosses}
            diversityFactor={diversityFactor}
            setDiversityFactor={setDiversityFactor}
            setShowPVProfile={setShowPVProfile}
            setShowBattery={setShowBattery}
            setUseSolcast={toggleSolcast}
          />

          <LoadChart chartData={chartData} showTOU={showTOU} isWeekend={isWeekend} unit={unit} />

          {envelopeData.length > 0 && (
            <EnvelopeChart
              envelopeData={envelopeData}
              availableYears={availableYears}
              yearFrom={envelopeYearFrom}
              yearTo={envelopeYearTo}
              setYearFrom={setEnvelopeYearFrom}
              setYearTo={setEnvelopeYearTo}
              unit={unit}
            />
          )}

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

          {showPVProfile && maxPvAcKva && chartData && (
            <GridFlowChart
              chartData={chartData}
              showTOU={showTOU}
              isWeekend={isWeekend}
              unit={unit}
            />
          )}

          {showPVProfile && maxPvAcKva && overPanelingStats && effectiveDcAcRatio > 1 && (
            <OverPanelingAnalysis stats={overPanelingStats} dcAcRatio={effectiveDcAcRatio} />
          )}

          {showBattery && showPVProfile && maxPvAcKva && chartData && (
            <BatteryChart chartData={chartData} batteryCapacity={batteryCapacity} batteryPower={batteryPower} />
          )}

          {showTOU && <TOULegend />}
          {showAnnotations && <AnnotationsPanel annotations={annotations} setAnnotations={setAnnotations} />}
        </CardContent>
      </Card>

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

      <TopContributors tenants={tenants} chartData={chartData} />

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
