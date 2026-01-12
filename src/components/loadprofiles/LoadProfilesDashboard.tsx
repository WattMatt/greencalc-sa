import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Database, Activity, TrendingUp } from "lucide-react";

interface DashboardProps {
  onNavigateToSites: () => void;
  onNavigateToMeters: () => void;
}

export function LoadProfilesDashboard({ onNavigateToSites, onNavigateToMeters }: DashboardProps) {
  const { data: stats } = useQuery({
    queryKey: ["load-profiles-stats"],
    queryFn: async () => {
      const [sitesRes, metersRes] = await Promise.all([
        supabase.from("sites").select("id, name, total_area_sqm"),
        supabase.from("scada_imports").select("id, site_id, data_points, date_range_start, date_range_end"),
      ]);

      const sites = sitesRes.data || [];
      const meters = metersRes.data || [];
      
      const assignedMeters = meters.filter(m => m.site_id);
      const totalDataPoints = meters.reduce((sum, m) => sum + (m.data_points || 0), 0);
      
      // Calculate date coverage
      const allDates = meters
        .filter(m => m.date_range_start && m.date_range_end)
        .map(m => ({
          start: new Date(m.date_range_start!),
          end: new Date(m.date_range_end!),
        }));
      
      let dateRange = null;
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.start.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.end.getTime())));
        dateRange = { start: minDate, end: maxDate };
      }

      return {
        siteCount: sites.length,
        meterCount: meters.length,
        assignedMeterCount: assignedMeters.length,
        unassignedMeterCount: meters.length - assignedMeters.length,
        totalDataPoints,
        totalArea: sites.reduce((sum, s) => sum + (s.total_area_sqm || 0), 0),
        dateRange,
      };
    },
  });

  const { data: recentMeters } = useQuery({
    queryKey: ["recent-meters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_name, meter_label, created_at, data_points")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onNavigateToSites}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total Sites</CardDescription>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.siteCount || 0}</div>
            {stats?.totalArea ? (
              <p className="text-xs text-muted-foreground">
                {stats.totalArea.toLocaleString()} m² total
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onNavigateToMeters}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total Meters</CardDescription>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.meterCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.assignedMeterCount || 0} assigned to sites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Data Points</CardDescription>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalDataPoints 
                ? stats.totalDataPoints >= 1_000_000 
                  ? (stats.totalDataPoints / 1_000_000).toFixed(1) + "M"
                  : stats.totalDataPoints >= 1_000 
                    ? (stats.totalDataPoints / 1_000).toFixed(1) + "K"
                    : stats.totalDataPoints.toLocaleString()
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalDataPoints?.toLocaleString() || 0} readings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Date Coverage</CardDescription>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats?.dateRange ? (
              <>
                <div className="text-lg font-bold">
                  {stats.dateRange.start.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" })}
                  {" → "}
                  {stats.dateRange.end.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.ceil((stats.dateRange.end.getTime() - stats.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} days
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Imports</CardTitle>
            <CardDescription>Latest meters added to the library</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentMeters?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No meters imported yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentMeters.map((meter) => (
                  <div key={meter.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {meter.meter_label || meter.shop_name || meter.site_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(meter.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {(meter.data_points || 0).toLocaleString()} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Get started with your meter data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div 
              className="p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors"
              onClick={onNavigateToSites}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Create a Site</p>
                  <p className="text-xs text-muted-foreground">
                    Start by adding a site to organize your meters
                  </p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors"
              onClick={onNavigateToMeters}
            >
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Browse Meter Library</p>
                  <p className="text-xs text-muted-foreground">
                    View and manage all imported meters
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
