import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun, Battery, Zap, Settings } from "lucide-react";
import { SimulationData, EquipmentSpecs, formatNumber } from "../types";
import { ProposalTemplate } from "../templates/types";

interface EquipmentSpecsSectionProps {
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function EquipmentSpecsSection({ simulation, template, forPDF }: EquipmentSpecsSectionProps) {
  const primaryColor = template.colors.accentColor;
  const specs = simulation.equipmentSpecs || {};

  // Build equipment rows from available data
  const solarSpecs = [
    { label: "Panel Model", value: specs.panelModel || "Standard Tier 1" },
    { label: "Panel Wattage", value: specs.panelWattage ? `${specs.panelWattage} W` : `${Math.round((simulation.solarCapacity * 1000) / (specs.panelCount || Math.ceil(simulation.solarCapacity * 1000 / 550)))} W` },
    { label: "Panel Count", value: specs.panelCount ? `${specs.panelCount} panels` : `~${Math.ceil(simulation.solarCapacity * 1000 / 550)} panels` },
    { label: "Total DC Capacity", value: `${simulation.solarCapacity} kWp` },
    { label: "Panel Efficiency", value: specs.panelEfficiency ? `${specs.panelEfficiency}%` : "~21%" },
    { label: "Tilt Angle", value: specs.tiltAngle ? `${specs.tiltAngle}°` : "Optimized" },
    { label: "Azimuth", value: specs.azimuth ? `${specs.azimuth}° (${getAzimuthDirection(specs.azimuth)})` : "North-facing" },
    { label: "Mounting", value: specs.mountingType ? specs.mountingType.charAt(0).toUpperCase() + specs.mountingType.slice(1) : "Roof-mounted" },
  ];

  const inverterSpecs = [
    { label: "Inverter Model", value: specs.inverterModel || "High-efficiency String" },
    { label: "Inverter Power", value: specs.inverterPower ? `${specs.inverterPower} kW` : `${Math.round(simulation.solarCapacity * 0.8)} kW` },
    { label: "Inverter Count", value: specs.inverterCount ? `${specs.inverterCount} units` : "As required" },
    { label: "DC:AC Ratio", value: specs.inverterPower ? `${(simulation.solarCapacity / specs.inverterPower).toFixed(2)}` : "1.25" },
  ];

  const batterySpecs = simulation.batteryCapacity > 0 ? [
    { label: "Battery Model", value: specs.batteryModel || "Lithium-ion" },
    { label: "Usable Capacity", value: `${simulation.batteryCapacity} kWh` },
    { label: "Power Rating", value: `${simulation.batteryPower || Math.round(simulation.batteryCapacity / 2)} kW` },
    { label: "Depth of Discharge", value: "90%" },
    { label: "Round-trip Efficiency", value: "~92%" },
  ] : [];

  const performanceSpecs = [
    { label: "Annual Generation", value: `${formatNumber(simulation.annualSolarGeneration)} kWh` },
    { label: "Specific Yield", value: `${formatNumber(simulation.annualSolarGeneration / simulation.solarCapacity)} kWh/kWp` },
    { label: "Performance Ratio", value: "~82%" },
    { label: "Grid Export (Annual)", value: `${formatNumber(simulation.annualGridExport)} kWh` },
    { label: "Grid Import (Annual)", value: `${formatNumber(simulation.annualGridImport)} kWh` },
    { label: "Self-Consumption", value: simulation.selfConsumptionRate ? `${simulation.selfConsumptionRate.toFixed(1)}%` : "Calculated" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Settings className="h-5 w-5" style={{ color: primaryColor }} />
        Equipment Specifications
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Solar PV System */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sun className="h-4 w-4" style={{ color: primaryColor }} />
            <h3 className="font-medium text-sm">Solar PV System</h3>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableBody>
                {solarSpecs.map((spec, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <TableCell className="text-sm text-muted-foreground py-2">{spec.label}</TableCell>
                    <TableCell className="text-sm font-medium text-right py-2">{spec.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Inverter System */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4" style={{ color: primaryColor }} />
            <h3 className="font-medium text-sm">Inverter System</h3>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableBody>
                {inverterSpecs.map((spec, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <TableCell className="text-sm text-muted-foreground py-2">{spec.label}</TableCell>
                    <TableCell className="text-sm font-medium text-right py-2">{spec.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Battery System (if applicable) */}
          {batterySpecs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3 mt-4">
                <Battery className="h-4 w-4" style={{ color: primaryColor }} />
                <h3 className="font-medium text-sm">Battery Storage</h3>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableBody>
                    {batterySpecs.map((spec, i) => (
                      <TableRow key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                        <TableCell className="text-sm text-muted-foreground py-2">{spec.label}</TableCell>
                        <TableCell className="text-sm font-medium text-right py-2">{spec.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mt-6">
        <h3 className="font-medium text-sm mb-3">Expected Performance</h3>
        <div className="grid grid-cols-3 gap-4">
          {performanceSpecs.map((spec, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs text-muted-foreground">{spec.label}</p>
              <p className="font-semibold text-sm">{spec.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getAzimuthDirection(azimuth: number): string {
  if (azimuth >= 337.5 || azimuth < 22.5) return "N";
  if (azimuth >= 22.5 && azimuth < 67.5) return "NE";
  if (azimuth >= 67.5 && azimuth < 112.5) return "E";
  if (azimuth >= 112.5 && azimuth < 157.5) return "SE";
  if (azimuth >= 157.5 && azimuth < 202.5) return "S";
  if (azimuth >= 202.5 && azimuth < 247.5) return "SW";
  if (azimuth >= 247.5 && azimuth < 292.5) return "W";
  return "NW";
}
