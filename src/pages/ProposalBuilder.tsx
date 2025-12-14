import { AppLayout } from "@/components/layout/AppLayout";
import { PromptCard } from "@/components/simulation/PromptCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, CheckCircle, FileOutput, History } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PROPOSAL_PROMPT = `Develop the Proposal Builder Mode for creating client-ready solar installation proposals. This mode should:

1. Start from a completed simulation (from Profile Builder or Sandbox)
2. Add verification checklist requiring confirmation of:
   - Site coordinates verified
   - Consumption data source (actual vs estimated)
   - Tariff rates confirmed current
   - System specifications validated
   - Financial assumptions reviewed
3. Create professional PDF report template with sections:
   - Executive Summary (1 page with key metrics)
   - Site Overview with map and satellite imagery
   - System Specification table (panels, inverters, batteries)
   - Energy Analysis (generation, consumption, coverage)
   - Financial Analysis (25-year cash flow projection)
   - Assumptions & Disclaimers
   - Appendix with detailed hourly/monthly data
4. Add company branding options:
   - Logo upload
   - Brand colors
   - Contact information
   - Custom footer text
5. Implement version tracking (v1.0, v1.1, etc.)
6. Add digital signature/approval workflow
7. Export to PDF and Excel formats
8. Include QR code linking to live simulation

Technical requirements:
- Create src/pages/ProposalWorkspace.tsx as the main builder
- Create src/components/proposal/VerificationChecklist.tsx
- Create src/components/proposal/ReportPreview.tsx for live preview
- Create src/components/proposal/BrandingSettings.tsx
- Use react-pdf or similar for PDF generation
- Store proposals in 'proposals' table with version tracking
- Add 'proposal_versions' table for history

The proposal should look professional enough to present to C-level executives.`;

export default function ProposalBuilder() {
  const navigate = useNavigate();

  const features = [
    {
      icon: CheckCircle,
      title: "Verification Checklist",
      description: "Ensure all data is verified before generating client-facing documents",
    },
    {
      icon: FileOutput,
      title: "Professional Reports",
      description: "Generate branded PDF and Excel reports with executive summaries",
    },
    {
      icon: History,
      title: "Version Tracking",
      description: "Keep track of all proposal revisions with full history",
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
              <h1 className="text-2xl font-bold tracking-tight">Proposal Builder</h1>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <p className="text-muted-foreground">
              Create professional, client-ready proposals with verified data
            </p>
          </div>
        </div>

        {/* Coming Soon Hero */}
        <Card className="border-dashed bg-muted/30">
          <CardContent className="py-12 text-center">
            <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">Under Development</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The Proposal Builder will help you create professional, branded proposals
              with verification workflows and version tracking.
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
          description="Copy this prompt to implement Proposal Builder"
          prompt={PROPOSAL_PROMPT}
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
