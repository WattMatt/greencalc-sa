import React from "react";
import { cn } from "@/lib/utils";
import { ProposalTemplate } from "../templates/types";
import { SimulationData } from "../types";
import { LoadProfileChart } from "@/components/projects/load-profile";
import { Tenant, ShopType } from "@/components/projects/load-profile/types";
import { BarChart3, Zap } from "lucide-react";

interface LoadAnalysisSectionProps {
  simulation: SimulationData;
  template: ProposalTemplate;
  tenants?: Tenant[];
  shopTypes?: ShopType[];
  project?: any;
  forPDF?: boolean;
}

export function LoadAnalysisSection({
  simulation,
  template,
  tenants = [],
  shopTypes = [],
  project,
  forPDF = false,
}: LoadAnalysisSectionProps) {
  const accentColor = template.colors.accentColor;

  const totalMonthlyKwh = tenants.reduce((sum, t) => {
    const shopType = shopTypes.find(st => st.id === t.shop_type_id);
    const calculated = t.area_sqm * (shopType?.kwh_per_sqm_month || 50);
    return sum + (t.monthly_kwh_override || calculated);
  }, 0);

  const totalArea = tenants.reduce((sum, t) => sum + (t.area_sqm || 0), 0);
  const tenantCount = tenants.length;
  const avgKwhPerSqm = totalArea > 0 ? totalMonthlyKwh / totalArea : 0;

  // Convert DB tenants to chart-compatible format
  const chartTenants: Tenant[] = tenants.map(t => ({
    id: t.id,
    name: t.name,
    area_sqm: t.area_sqm,
    shop_type_id: t.shop_type_id,
    monthly_kwh_override: t.monthly_kwh_override,
    scada_import_id: t.scada_import_id,
    scada_imports: t.scada_imports,
  }));

  const chartShopTypes: ShopType[] = shopTypes.map(st => ({
    id: st.id,
    name: st.name,
    kwh_per_sqm_month: st.kwh_per_sqm_month,
    load_profile_weekday: st.load_profile_weekday || Array(24).fill(4.17),
    load_profile_weekend: st.load_profile_weekend || Array(24).fill(4.17),
  }));

  return (
    <div className={cn("space-y-6", forPDF && "text-[11px]")}>
      {/* Section Header */}
      <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: accentColor }}>
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <BarChart3 className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <div>
          <h2 className={cn("font-semibold text-foreground", forPDF ? "text-base" : "text-lg")}>
            Load Analysis
          </h2>
          <p className="text-xs text-muted-foreground">Consumption patterns and demand profile</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">Total Tenants</p>
          <p className="text-lg font-semibold">{tenantCount}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">Total Area</p>
          <p className="text-lg font-semibold">{totalArea.toLocaleString()} m²</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">Monthly Consumption</p>
          <p className="text-lg font-semibold">{Math.round(totalMonthlyKwh).toLocaleString()} kWh</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">Avg Intensity</p>
          <p className="text-lg font-semibold">{avgKwhPerSqm.toFixed(1)} kWh/m²</p>
        </div>
      </div>

      {/* Load Profile Chart - only show if we have tenants */}
      {tenantCount > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <LoadProfileChart
            tenants={chartTenants}
            shopTypes={chartShopTypes}
            connectionSizeKva={project?.connection_size_kva}
            latitude={project?.latitude}
            longitude={project?.longitude}
            simulatedSolarCapacityKwp={simulation.solarCapacity}
            simulatedBatteryCapacityKwh={simulation.batteryCapacity}
            simulatedBatteryPowerKw={simulation.batteryPower}
          />
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center bg-muted/30">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No tenant data available. Add tenants to the project to display load analysis.
          </p>
        </div>
      )}

      {/* Tenant Breakdown Table */}
      {tenantCount > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Tenant</th>
                <th className="text-right px-3 py-2 font-medium">Area (m²)</th>
                <th className="text-right px-3 py-2 font-medium">Category</th>
                <th className="text-right px-3 py-2 font-medium">Monthly kWh</th>
                <th className="text-right px-3 py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {tenants.slice(0, forPDF ? 10 : 15).map((tenant, idx) => {
                const shopType = shopTypes.find(st => st.id === tenant.shop_type_id);
                const calculated = tenant.area_sqm * (shopType?.kwh_per_sqm_month || 50);
                const monthlyKwh = tenant.monthly_kwh_override || calculated;
                const percentage = totalMonthlyKwh > 0 ? (monthlyKwh / totalMonthlyKwh) * 100 : 0;
                
                return (
                  <tr key={tenant.id} className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                    <td className="px-3 py-2 font-medium">{tenant.name}</td>
                    <td className="px-3 py-2 text-right">{tenant.area_sqm.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {shopType?.name || "Generic"}
                    </td>
                    <td className="px-3 py-2 text-right">{Math.round(monthlyKwh).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{percentage.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {tenants.length > (forPDF ? 10 : 15) && (
                <tr className="bg-muted/30">
                  <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">
                    + {tenants.length - (forPDF ? 10 : 15)} more tenants
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-muted/50 font-medium">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{totalArea.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right">{Math.round(totalMonthlyKwh).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
