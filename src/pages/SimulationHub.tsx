import { ModeCard } from "@/components/simulation/ModeCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Layers, FlaskConical, FileCheck, Map, ArrowRight, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SimulationHub() {
  const navigate = useNavigate();

  // Check user context for recommendations
  const { data: projectCount } = useQuery({
    queryKey: ["project-count"],
    queryFn: async () => {
      const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: tariffCount } = useQuery({
    queryKey: ["tariff-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tariffs").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const modes = [
    {
      title: "Quick Estimate",
      description: "Get instant ballpark figures for a theoretical site. No project setup required.",
      icon: Zap,
      idealFor: ["Initial feasibility", "Client conversations", "Quick comparisons"],
      features: ["Location-based irradiance", "Default assumptions", "Instant results", "±20% accuracy"],
      status: "available" as const,
      route: "/simulations/quick-estimate",
      variant: "primary" as const,
    },
    {
      title: "Profile Builder",
      description: "Build detailed load profiles from tenant data and SCADA imports for accurate modeling.",
      icon: Layers,
      idealFor: ["Existing buildings", "Detailed analysis", "Actual consumption data"],
      features: ["Tenant stacking", "SCADA integration", "TOU analysis", "Battery simulation"],
      status: "available" as const,
      route: "/projects",
      variant: "default" as const,
    },
    {
      title: "Sandbox",
      description: "Experiment freely with different scenarios. Clone projects, sweep parameters, compare options.",
      icon: FlaskConical,
      idealFor: ["What-if analysis", "Parameter tuning", "System optimization"],
      features: ["Clone any project", "A/B/C comparison", "Parameter sweeps", "Draft reports"],
      status: "coming-soon" as const,
      route: "/simulations/sandbox",
      variant: "default" as const,
    },
    {
      title: "Proposal Builder",
      description: "Create professional, client-ready proposals with verified assumptions and branded reports.",
      icon: FileCheck,
      idealFor: ["Client proposals", "Final submissions", "Board presentations"],
      features: ["Verification checklist", "PDF export", "Version tracking", "Digital signatures"],
      status: "coming-soon" as const,
      route: "/simulations/proposal",
      variant: "default" as const,
    },
  ];

  return (
    <div className="container max-w-6xl py-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Simulation Hub</h1>
          <p className="text-muted-foreground">
            Choose the right simulation mode for your needs. Each mode is designed for a specific stage of your project.
          </p>
        </div>

        {/* Context-aware recommendation */}
        {(projectCount !== undefined || tariffCount !== undefined) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Recommended for you</p>
                  <p className="text-sm text-muted-foreground">
                    {projectCount && projectCount > 0 ? (
                      <>
                        You have {projectCount} project{projectCount > 1 ? "s" : ""}. 
                        Try <strong>Profile Builder</strong> for detailed analysis or 
                        <strong> Sandbox</strong> to experiment with configurations.
                      </>
                    ) : (
                      <>
                        New to simulations? Start with <strong>Quick Estimate</strong> to get 
                        instant ballpark figures, then create a project for detailed modeling.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mode Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {modes.map((mode) => (
            <ModeCard key={mode.title} {...mode} />
          ))}
        </div>

        {/* Development Roadmap Link */}
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Map className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Development Roadmap</p>
                  <p className="text-sm text-muted-foreground">
                    View progress and development prompts for upcoming features
                  </p>
                </div>
              </div>
              <Button variant="ghost" onClick={() => navigate("/simulations/roadmap")}>
                View Roadmap <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
