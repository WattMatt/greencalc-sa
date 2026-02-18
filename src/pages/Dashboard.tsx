import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, FileText, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [provinces, municipalities, tariffPlans, tariffRates] = await Promise.all([
        supabase.from("provinces").select("id", { count: "exact" }),
        supabase.from("municipalities").select("id", { count: "exact" }),
        supabase.from("tariff_plans").select("id", { count: "exact" }),
        supabase.from("tariff_rates").select("id", { count: "exact" }),
      ]);
      return {
        provinces: provinces.count || 0,
        municipalities: municipalities.count || 0,
        tariffPlans: tariffPlans.count || 0,
        tariffRates: tariffRates.count || 0,
      };
    },
  });

  const statCards = [
    { title: "Provinces", value: stats?.provinces || 0, icon: MapPin, description: "Configured regions" },
    { title: "Municipalities", value: stats?.municipalities || 0, icon: Building2, description: "Local authorities" },
    { title: "Tariff Plans", value: stats?.tariffPlans || 0, icon: FileText, description: "Rate structures" },
    { title: "Rate Lines", value: stats?.tariffRates || 0, icon: TrendingUp, description: "Individual charges" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your South African municipal electricity tariff database
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/tariffs" className="block p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
              <div className="font-medium text-accent-foreground">Browse Tariffs</div>
              <div className="text-sm text-muted-foreground">View NERSA municipal electricity tariff data</div>
            </a>
            <a href="/calculator" className="block p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
              <div className="font-medium text-accent-foreground">Calculate Solar ROI</div>
              <div className="text-sm text-muted-foreground">Model payback period for renewable energy systems</div>
            </a>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">About This Platform</CardTitle>
            <CardDescription>Green Energy Financial Modelling</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This platform helps you model ROI and payback periods for solar and battery 
              installations based on South African municipal electricity tariffs.
            </p>
            <p>
              Features include IBT (Inclining Block Tariffs), TOU (Time of Use), 
              and fixed rate structures with seasonal variations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
