import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tenant, ShopType, DAYS_OF_WEEK, DayOfWeek, DisplayUnit, Annotation } from "./types";
import { useLoadProfileData } from "./hooks/useLoadProfileData";
import { useExportHandlers } from "./hooks/useExportHandlers";
import { useSolcastPVProfile } from "./hooks/useSolcastPVProfile";
import { LoadChart } from "./charts/LoadChart";
import { SolarChart } from "./charts/SolarChart";
import { BatteryChart } from "./charts/BatteryChart";
import { ChartHeader } from "./components/ChartHeader";
import { ChartSettings } from "./components/ChartSettings";
import { ChartStats } from "./components/ChartStats";
import { OverPanelingAnalysis } from "./components/OverPanelingAnalysis";
import { AnnotationsPanel } from "./components/AnnotationsPanel";
import { TOULegend } from "./components/TOULegend";
import { TopContributors } from "./components/TopContributors";

interface LoadProfileChartProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  connectionSizeKva?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function LoadProfileChart({ tenants, shopTypes, connectionSizeKva, latitude, longitude }: LoadProfileChartProps) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(0.9);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Wednesday");
  const [showTOU, setShowTOU] = useState(true);
  const [showPVProfile, setShowPVProfile] = useState(false);
  const [showBattery, setShowBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(500);
  const [batteryPower, setBatteryPower] = useState(250);
  const [dcAcRatio, setDcAcRatio] = useState(1.3);
  const [show1to1Comparison, setShow1to1Comparison] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [systemLosses, setSystemLosses] = useState(0.14);
  const chartRef = useRef<HTMLDivElement>(null);

  const maxPvAcKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const dcCapacityKwp = maxPvAcKva ? maxPvAcKva * dcAcRatio : null;
  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const isWeekend = selectedDay === "Saturday" || selectedDay === "Sunday";
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

  const navigateDay = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? (dayIndex - 1 + 7) % 7 : (dayIndex + 1) % 7;
    setSelectedDay(DAYS_OF_WEEK[newIndex]);
  };

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
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDay,
    displayUnit,
    powerFactor,
    showPVProfile,
    maxPvAcKva,
    dcCapacityKwp,
    dcAcRatio,
    showBattery,
    batteryCapacity,
    batteryPower,
    solcastProfile: useSolcast ? solcastProfile : undefined,
    systemLosses,
  });

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
          />

          {/* Load Profile Chart */}
          <LoadChart chartData={chartData} showTOU={showTOU} isWeekend={isWeekend} unit={unit} />

          {/* PV Generation Chart */}
          {showPVProfile && maxPvAcKva && (
            <>
              <SolarChart
                chartData={chartData}
                showTOU={showTOU}
                isWeekend={isWeekend}
                dcAcRatio={dcAcRatio}
                show1to1Comparison={show1to1Comparison}
                unit={unit}
              />

              {/* Over-Paneling Summary */}
              {overPanelingStats && dcAcRatio > 1 && <OverPanelingAnalysis stats={overPanelingStats} dcAcRatio={dcAcRatio} />}
            </>
          )}

          {/* Battery Chart */}
          {showBattery && showPVProfile && maxPvAcKva && (
            <BatteryChart chartData={chartData} batteryCapacity={batteryCapacity} batteryPower={batteryPower} />
          )}

          {/* TOU Legend */}
          {showTOU && <TOULegend />}

          {/* Annotations Panel */}
          {showAnnotations && <AnnotationsPanel annotations={annotations} setAnnotations={setAnnotations} />}
        </CardContent>
      </Card>

      {/* Compact Stats Row */}
      <ChartStats totalDaily={totalDaily} avgHourly={avgHourly} loadFactor={loadFactor} unit={unit} pvStats={pvStats} />

      {/* Top Contributors */}
      <TopContributors tenants={tenants} chartData={chartData} />
    </div>
  );
}
