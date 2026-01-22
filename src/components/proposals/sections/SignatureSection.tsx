import { PenLine, Check, User, Calendar } from "lucide-react";
import { Proposal, ProposalBranding } from "../types";
import { ProposalTemplate } from "../templates/types";
import { format } from "date-fns";

interface SignatureSectionProps {
  proposal: Partial<Proposal>;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function SignatureSection({ proposal, template, forPDF }: SignatureSectionProps) {
  const primaryColor = template.colors.accentColor;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <PenLine className="h-5 w-5" style={{ color: primaryColor }} />
        Authorization
      </h2>

      <div className="grid grid-cols-2 gap-8">
        {/* Prepared By */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Prepared By</span>
          </div>
          
          <div className="border-b-2 border-dashed h-12 flex items-end pb-2">
            {proposal.prepared_by ? (
              <span className="font-medium">{proposal.prepared_by}</span>
            ) : (
              <span className="text-muted-foreground text-sm italic">Signature</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {proposal.prepared_at 
                ? format(new Date(proposal.prepared_at), "MMMM d, yyyy")
                : "Date"
              }
            </span>
          </div>
          
          {proposal.branding?.company_name && (
            <p className="text-sm text-muted-foreground">
              {proposal.branding.company_name}
            </p>
          )}
        </div>

        {/* Client Signature */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PenLine className="h-4 w-4" />
            <span>Client Acceptance</span>
          </div>
          
          <div className="border-b-2 border-dashed h-12 flex items-end pb-2">
            {proposal.client_signature ? (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{proposal.client_signature}</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm italic">Client Signature</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {proposal.client_signed_at 
                ? format(new Date(proposal.client_signed_at), "MMMM d, yyyy")
                : "Date"
              }
            </span>
          </div>
        </div>
      </div>

      {/* Footer Contact */}
      {proposal.branding && (
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          <p className="font-medium">{proposal.branding.company_name}</p>
          <p className="mt-1">
            {[
              proposal.branding.contact_email,
              proposal.branding.contact_phone,
              proposal.branding.website
            ].filter(Boolean).join(" • ")}
          </p>
          {proposal.branding.address && (
            <p className="mt-1">{proposal.branding.address}</p>
          )}
        </div>
      )}
    </div>
  );
}
