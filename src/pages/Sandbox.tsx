import { AppLayout } from "@/components/layout/AppLayout";
import { PromptCard } from "@/components/simulation/PromptCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FlaskConical, GitBranch, SlidersHorizontal, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SANDBOX_PROMPT = `Develop the Sandbox/Playground Mode for energy simulations. This mode should:

1. Allow users to clone any existing project into a sandbox environment
2. Add parameter sweep functionality with sliders for:
   - Solar capacity range (min-max with step)
   - Battery capacity range  
   - DC/AC ratio range
3. Enable A/B/C scenario comparison with side-by-side result cards
4. Add 'Save Draft' functionality separate from production simulations
5. Generate shareable draft reports with watermark
6. Include undo/redo for parameter changes
7. Add 'Promote to Project' button to convert sandbox to real project

The sandbox should feel experimental with a distinct visual theme (dashed borders, 'DRAFT' watermarks).

Technical requirements:
- Create src/pages/SandboxWorkspace.tsx as the main workspace
- Create src/components/sandbox/ParameterSweep.tsx for range sliders
- Create src/components/sandbox/ScenarioComparison.tsx for A/B/C view
- Store drafts in a new 'sandbox_simulations' table with project_id reference
- Add 'cloned_from' column to track source project
- Include visual indicators that this is a draft environment`;

export default function Sandbox() {
  const navigate = useNavigate();

  const features = [
    {
      icon: GitBranch,
      title: "Clone Projects",
      description: "Create experimental copies of any project without affecting the original",
    },
    {
      icon: SlidersHorizontal,
      title: "Parameter Sweeps",
      description: "Test ranges of values to find optimal system configurations",
    },
    {
      icon: FileText,
      title: "Draft Reports",
      description: "Generate watermarked reports for internal review before finalizing",
    },
  ];

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/simulations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Sandbox Mode</h1>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <p className="text-muted-foreground">
              Experiment freely with different scenarios without affecting production data
            </p>
          </div>
        </div>

        {/* Coming Soon Hero */}
        <Card className="border-dashed bg-muted/30">
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">Under Development</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The Sandbox Mode will allow you to experiment with different system configurations,
              compare scenarios side-by-side, and generate draft reports.
            </p>
          </CardContent>
        </Card>

        {/* Feature Preview */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Planned Features</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="pt-6">
                  <feature.icon className="h-8 w-8 mb-3 text-primary" />
                  <h4 className="font-medium mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Development Prompt */}
        <PromptCard
          title="Development Prompt"
          description="Copy this prompt to implement Sandbox Mode"
          prompt={SANDBOX_PROMPT}
        />

        {/* Back to Hub */}
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate("/simulations")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Simulation Hub
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
