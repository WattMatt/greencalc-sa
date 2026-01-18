import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tenant, ShopType, DAYS_OF_WEEK, DayOfWeek, DisplayUnit, Annotation } from "./types";
import { useLoadProfileData } from "./hooks/useLoadProfileData";
import { useSpecificDateData } from "./hooks/useSpecificDateData";
import { useMonthlyData } from "./hooks/useMonthlyData";
import { useExportHandlers } from "./hooks/useExportHandlers";
import { useSolcastPVProfile } from "./hooks/useSolcastPVProfile";
import { LoadChart } from "./charts/LoadChart";
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
import { DateMode } from "./components/DateModeSelector";
import { MethodologySection, solarMethodology, batteryMethodology, financialMethodology, touMethodology } from "@/components/simulation/MethodologySection";
import { useDeratingSettings } from "@/hooks/useDeratingSettings";
import { useDiversitySettings } from "@/hooks/useDiversitySettings";

interface LoadProfileChartProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  connectionSizeKva?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function LoadProfileChart({ tenants, shopTypes, connectionSizeKva, latitude, longitude }: LoadProfileChartProps) {
  // Get global settings as defaults - Diversity for load profiles, Derating for PV simulations
  const { settings: globalDeratingSettings } = useDeratingSettings();
  const { settings: globalDiversitySettings } = useDiversitySettings();
  
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(() => globalDeratingSettings.powerFactor);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Wednesday");
  const [showTOU, setShowTOU] = useState(true);
  const [showPVProfile, setShowPVProfile] = useState(false);
  const [showBattery, setShowBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(500);
  const [batteryPower, setBatteryPower] = useState(250);
  const [dcAcRatio, setDcAcRatio] = useState(() => globalDeratingSettings.dcAcRatio);
  const [show1to1Comparison, setShow1to1Comparison] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [systemLosses, setSystemLosses] = useState(() => globalDeratingSettings.systemLosses);
  // Use diversity settings for load profile diversity factor
  const [diversityFactor, setDiversityFactor] = useState(() => globalDiversitySettings.diversityFactor);
  const [dateMode, setDateMode] = useState<DateMode>("average");
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const maxPvAcKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const dcCapacityKwp = maxPvAcKva ? maxPvAcKva * dcAcRatio : null;
  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const unit = displayUnit === "kwh" ? "kWh" : "kVA";

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

  // Specific date data hook
  const {
    chartData: specificDateChartData,
    availableDateRange,
    hasRawData: specificDateHasRawData,
  } = useSpecificDateData({
    tenants,
    shopTypes,
    selectedDate: specificDate || null,
    displayUnit,
    powerFactor,
  });

  // Monthly data hook
  const {
    chartData: monthlyChartData,
    availableMonths,
    monthlyStats,
    hasRawData: monthlyHasRawData,
  } = useMonthlyData({
    tenants,
    shopTypes,
    selectedMonth,
    displayUnit,
    powerFactor,
  });

  const hasRawData = specificDateHasRawData || monthlyHasRawData;

  const navigateDay = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? (dayIndex - 1 + 7) % 7 : (dayIndex + 1) % 7;
    setSelectedDay(DAYS_OF_WEEK[newIndex]);
  };

  // Averaged data hook
  const {
    chartData: averagedChartData,
    totalDaily: avgTotalDaily,
    peakHour: avgPeakHour,
    avgHourly: avgAvgHourly,
    loadFactor: avgLoadFactor,
    pvStats,
    overPanelingStats,
    tenantsWithScada,
    tenantsEstimated,
    isWeekend,
    weekdayDailyKwh,
    weekendDailyKwh,
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDay,
    displayUnit,
    powerFactor,
    showPVProfile: dateMode === "average" && showPVProfile,
    maxPvAcKva,
    dcCapacityKwp,
    dcAcRatio,
    showBattery: dateMode === "average" && showBattery,
    batteryCapacity,
    batteryPower,
    solcastProfile: useSolcast ? solcastProfile : undefined,
    systemLosses,
    diversityFactor,
  });

  // Use appropriate data based on mode
  const chartData = dateMode === "month" && monthlyChartData 
    ? monthlyChartData 
    : dateMode === "specific" && specificDateChartData 
      ? specificDateChartData 
      : averagedChartData;
  
  const totalDaily = dateMode === "month" && monthlyChartData
    ? monthlyChartData.reduce((sum, d) => sum + d.total, 0)
    : dateMode === "specific" && specificDateChartData 
      ? specificDateChartData.reduce((sum, d) => sum + d.total, 0)
      : avgTotalDaily;
  
  const peakHour = dateMode === "month" && monthlyChartData
    ? monthlyChartData.reduce((max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max), { val: 0, hour: 0 })
    : dateMode === "specific" && specificDateChartData
      ? specificDateChartData.reduce((max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max), { val: 0, hour: 0 })
      : avgPeakHour;
  
  const avgHourly = totalDaily / 24;
  const loadFactor = peakHour.val > 0 ? (avgHourly / peakHour.val) * 100 : 0;
  
  // For specific date mode, determine if it's a weekend
  const effectiveIsWeekend = dateMode === "specific" && specificDate
    ? (specificDate.getDay() === 0 || specificDate.getDay() === 6)
    : isWeekend;

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
            isWeekend={effectiveIsWeekend}
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
            // Date mode props
            dateMode={dateMode}
            onDateModeChange={setDateMode}
            specificDate={specificDate}
            onSpecificDateChange={setSpecificDate}
            availableDates={availableDateRange.availableDates}
            dateRangeStart={availableDateRange.startDate}
            dateRangeEnd={availableDateRange.endDate}
            hasRawData={hasRawData}
            // Monthly mode props
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            availableMonths={availableMonths}
            monthlyStats={monthlyStats}
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
            dcAcRatio={dcAcRatio}
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

          {/* No data message for month mode */}
          {dateMode === "month" && !monthlyChartData && selectedMonth && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No SCADA data available for {selectedMonth}</p>
            </div>
          )}

          {/* No data message for specific date */}
          {dateMode === "specific" && !specificDateChartData && specificDate && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No SCADA data available for {specificDate.toLocaleDateString()}</p>
            </div>
          )}

          {/* Load Profile Chart */}
          <LoadChart chartData={chartData} showTOU={showTOU} isWeekend={effectiveIsWeekend} unit={unit} />

          {/* PV Generation Chart */}
          {showPVProfile && maxPvAcKva && dateMode === "average" && (
            <SolarChart
              chartData={chartData}
              showTOU={showTOU}
              isWeekend={effectiveIsWeekend}
              dcAcRatio={dcAcRatio}
              show1to1Comparison={show1to1Comparison}
              unit={unit}
            />
          )}

          {/* Grid Flow Chart */}
          {showPVProfile && maxPvAcKva && dateMode === "average" && (
            <GridFlowChart
              chartData={chartData}
              showTOU={showTOU}
              isWeekend={effectiveIsWeekend}
              unit={unit}
            />
          )}


          {/* Over-Paneling Summary */}
          {showPVProfile && maxPvAcKva && overPanelingStats && dcAcRatio > 1 && dateMode === "average" && (
            <OverPanelingAnalysis stats={overPanelingStats} dcAcRatio={dcAcRatio} />
          )}

          {/* Battery Chart */}
          {showBattery && showPVProfile && maxPvAcKva && dateMode === "average" && (
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
        pvStats={dateMode === "average" ? pvStats : null}
        weekdayDailyKwh={weekdayDailyKwh}
        weekendDailyKwh={weekendDailyKwh}
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
