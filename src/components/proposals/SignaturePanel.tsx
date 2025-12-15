import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PenLine, CheckCircle2, Clock, User, Send } from "lucide-react";
import type { Proposal } from "./types";
import { STATUS_LABELS, STATUS_COLORS } from "./types";

interface SignaturePanelProps {
  proposal: Partial<Proposal>;
  onUpdate: (updates: Partial<Proposal>) => void;
  disabled?: boolean;
}

export function SignaturePanel({ proposal, onUpdate, disabled }: SignaturePanelProps) {
  const handlePrepare = (name: string) => {
    onUpdate({
      prepared_by: name,
      prepared_at: new Date().toISOString(),
      status: 'pending_review',
    });
  };

  const handleReview = (name: string) => {
    onUpdate({
      reviewed_by: name,
      reviewed_at: new Date().toISOString(),
    });
  };

  const handleApprove = (name: string) => {
    onUpdate({
      approved_by: name,
      approved_at: new Date().toISOString(),
      status: 'approved',
    });
  };

  const handleSend = () => {
    onUpdate({ status: 'sent' });
  };

  const handleClientSign = (signature: string) => {
    onUpdate({
      client_signature: signature,
      client_signed_at: new Date().toISOString(),
      status: 'accepted',
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Approval Workflow</CardTitle>
          </div>
          <Badge variant="outline" className={STATUS_COLORS[proposal.status || 'draft']}>
            {STATUS_LABELS[proposal.status || 'draft']}
          </Badge>
        </div>
        <CardDescription>
          Track preparation, review, and approval of this proposal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prepared By */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Prepared By
          </Label>
          {proposal.prepared_by ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">{proposal.prepared_by}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(proposal.prepared_at)}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Your name"
                id="prepare-name"
                disabled={disabled}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.getElementById('prepare-name') as HTMLInputElement;
                  if (input?.value) handlePrepare(input.value);
                }}
                disabled={disabled}
              >
                Mark Prepared
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Reviewed By */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Reviewed By
          </Label>
          {proposal.reviewed_by ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">{proposal.reviewed_by}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(proposal.reviewed_at)}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Reviewer name"
                id="review-name"
                disabled={disabled || !proposal.prepared_by}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.getElementById('review-name') as HTMLInputElement;
                  if (input?.value) handleReview(input.value);
                }}
                disabled={disabled || !proposal.prepared_by}
              >
                Mark Reviewed
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Approved By */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approved By
          </Label>
          {proposal.approved_by ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">{proposal.approved_by}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(proposal.approved_at)}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Approver name"
                id="approve-name"
                disabled={disabled || !proposal.reviewed_by}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.getElementById('approve-name') as HTMLInputElement;
                  if (input?.value) handleApprove(input.value);
                }}
                disabled={disabled || !proposal.reviewed_by}
              >
                Approve
              </Button>
            </div>
          )}
        </div>

        {/* Send to Client */}
        {proposal.approved_by && proposal.status === 'approved' && (
          <>
            <Separator />
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleSend}
                disabled={disabled}
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent to Client
              </Button>
            </div>
          </>
        )}

        {/* Client Signature */}
        {(proposal.status === 'sent' || proposal.status === 'accepted') && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Client Signature
              </Label>
              {proposal.client_signature ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{proposal.client_signature}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(proposal.client_signed_at)}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Client name"
                    id="client-name"
                    disabled={disabled}
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('client-name') as HTMLInputElement;
                      if (input?.value) handleClientSign(input.value);
                    }}
                    disabled={disabled}
                  >
                    Record Signature
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
