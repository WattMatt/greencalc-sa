import { FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { Proposal, ProposalBranding } from "../types";
import { ProposalTemplate } from "../templates/types";

interface TermsSectionProps {
  proposal: Partial<Proposal>;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function TermsSection({ proposal, template, forPDF }: TermsSectionProps) {
  const primaryColor = template.colors.accentColor;

  const defaultAssumptions = `• 0.5% annual panel degradation
• 6% annual CPI/inflation rate for operating costs
• 8% annual electricity tariff escalation
• 9% cost of capital (discount rate)
• Standard weather conditions based on historical data
• 20-year project lifetime`;

  const defaultDisclaimers = `This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors. Financial projections assume current tariff rates and standard escalation assumptions. All figures are estimates only and do not constitute a guarantee of performance or returns.`;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" style={{ color: primaryColor }} />
        Terms & Conditions
      </h2>

      <div className="space-y-6">
        {/* Assumptions */}
        <div className="p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Key Assumptions</h3>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {proposal.assumptions || defaultAssumptions}
          </p>
        </div>

        {/* Disclaimers */}
        <div className="p-4 rounded-lg border bg-destructive/5 border-destructive/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-medium text-destructive">Important Disclaimers</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {proposal.disclaimers || defaultDisclaimers}
          </p>
        </div>

        {/* Custom Notes */}
        {proposal.custom_notes && (
          <div className="p-4 rounded-lg border">
            <h3 className="font-medium mb-2">Additional Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {proposal.custom_notes}
            </p>
          </div>
        )}

        {/* Validity */}
        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          <p>This proposal is valid for 30 days from the date of issue.</p>
          <p className="mt-1">For questions, contact: {proposal.branding?.contact_email || "—"}</p>
        </div>
      </div>
    </div>
  );
}
