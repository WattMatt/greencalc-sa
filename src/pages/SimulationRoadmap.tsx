import { PromptCard } from "@/components/simulation/PromptCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Circle, Zap, Layers, FlaskConical, FileCheck, HelpCircle, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const phases = [
  {
    id: 1,
    name: "Simulation Hub & Quick Estimate",
    icon: Zap,
    status: "complete" as const,
    description: "Central hub for all simulation modes with fully functional quick estimate tool",
    features: [
      "Mode selection hub with recommendations",
      "Quick estimate with location-based irradiance",
      "Default assumptions with advanced options",
      "Instant results with accuracy disclaimers",
    ],
    prompt: null,
  },
  {
    id: 2,
    name: "Profile Builder Enhancements",
    icon: Layers,
    status: "complete" as const,
    description: "Existing project-based simulation with tenant stacking and load modeling",
    features: [
      "Tenant management and profile assignment",
      "SCADA meter integration",
      "TOU period visualization",
      "Battery and PV simulation",
    ],
    prompt: null,
  },
  {
    id: 3,
    name: "Sandbox Mode",
    icon: FlaskConical,
    status: "complete" as const,
    description: "Experimental environment for what-if analysis and parameter optimization",
    features: [
      "Clone projects to sandbox",
      "Parameter sweep with ranges",
      "A/B/C scenario comparison",
      "Draft reports with watermarks",
    ],
    prompt: null,
  },
  {
    id: 4,
    name: "Proposal Builder",
    icon: FileCheck,
    status: "complete" as const,
    description: "Create professional, client-ready proposals with verification and branding",
    features: [
      "Verification checklist workflow",
      "Professional PDF report generation",
      "Company branding options",
      "Version tracking and history",
      "Digital signature/approval workflow",
      "25-year financial projections",
      "Excel export with hourly data",
    ],
    prompt: null,
  },
  {
    id: 5,
    name: "Guided Tooltips System",
    icon: HelpCircle,
    status: "complete" as const,
    description: "Comprehensive contextual help and onboarding across all simulation modes",
    features: [
      "TourProvider context with localStorage persistence",
      "Spotlight overlay with step-by-step tours",
      "Mode-specific onboarding tours (5 defined)",
      "HelpTooltip component for contextual info",
      "Tour completion tracking",
      "Data-tour attributes on key inputs",
      "Auto-start tours for first-time visitors",
    ],
    prompt: null,
  },
  {
    id: 6,
    name: "Methodology Documentation",
    icon: HelpCircle,
    status: "complete" as const,
    description: "Expandable methodology sections explaining calculation logic",
    features: [
      "Solar generation calculation methodology",
      "Battery simulation logic documentation",
      "Financial projections assumptions",
      "TOU period explanations",
      "Collapsible sections in simulation pages",
      "Data accuracy badges (green/amber/red)",
    ],
    prompt: null,
  },
  {
    id: 7,
    name: "Advanced Features",
    icon: Settings2,
    status: "complete" as const,
    description: "Sophisticated modeling features for detailed long-term projections",
    features: [
      "Seasonal variation modeling",
      "Degradation curves (panel, battery)",
      "NPV and IRR calculations",
      "Sensitivity analysis",
      "Grid constraints & wheeling",
      "Load growth modeling",
    ],
    prompt: null,
  },
];

export default function SimulationRoadmap() {
  const navigate = useNavigate();

  const completedCount = phases.filter((p) => p.status === "complete").length;
  const progressPercentage = (completedCount / phases.length) * 100;

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/simulations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Development Roadmap</h1>
          <p className="text-muted-foreground">
            Track progress and access development prompts for simulation features
          </p>
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {phases.length} phases complete
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </CardContent>
      </Card>

      {/* Phase List */}
      <div className="space-y-4">
        {phases.map((phase) => (
          <Card key={phase.id} className={phase.status === "complete" ? "border-green-500/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${phase.status === "complete" ? "bg-green-500/10" : "bg-muted"}`}>
                    <phase.icon className={`h-5 w-5 ${phase.status === "complete" ? "text-green-600" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Phase {phase.id}: {phase.name}
                      {phase.status === "complete" ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Circle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{phase.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">FEATURES</p>
                <ul className="grid grid-cols-2 gap-1 text-sm">
                  {phase.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-muted-foreground">
                      {phase.status === "complete" ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              {phase.prompt && (
                <PromptCard
                  title="Development Prompt"
                  description="Copy this prompt to start building this phase"
                  prompt={phase.prompt}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
