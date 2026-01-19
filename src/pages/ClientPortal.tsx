import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, FileCheck, Loader2, AlertCircle, PenLine } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProposalPreview } from "@/components/proposals/ProposalPreview";
import type { SimulationData, ProposalBranding } from "@/components/proposals/types";

export default function ClientPortal() {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // Fetch proposal by share token
  const { data: proposal, isLoading, error } = useQuery({
    queryKey: ["proposal-by-token", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("share_token", token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Fetch associated project
  const { data: project } = useQuery({
    queryKey: ["project-for-proposal", proposal?.project_id],
    queryFn: async () => {
      if (!proposal?.project_id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", proposal.project_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.project_id,
  });

  // Fetch tenants for load profile
  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", proposal?.project_id],
    queryFn: async () => {
      if (!proposal?.project_id) return [];
      const { data, error } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end, detected_interval_minutes)`)
        .eq("project_id", proposal.project_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.project_id,
  });

  // Fetch shop types
  const { data: shopTypes } = useQuery({
    queryKey: ["shop-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Sign proposal mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!proposal?.id || !clientName.trim()) {
        throw new Error("Please enter your name");
      }

      const { error } = await supabase
        .from("proposals")
        .update({
          client_signature: clientName.trim(),
          client_signed_at: new Date().toISOString(),
          status: "accepted",
        })
        .eq("id", proposal.id)
        .eq("share_token", token);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposal signed successfully!");
      queryClient.invalidateQueries({ queryKey: ["proposal-by-token", token] });
    },
    onError: (error) => {
      console.error("Sign error:", error);
      toast.error("Failed to sign proposal");
    },
  });

  const handleSign = async () => {
    if (!clientName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!agreedToTerms) {
      toast.error("Please agree to the terms");
      return;
    }
    setIsSigning(true);
    await signMutation.mutateAsync();
    setIsSigning(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Proposal Not Found</h2>
            <p className="text-muted-foreground">
              This proposal link is invalid or has expired. Please contact the sender for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const branding = proposal.branding as unknown as ProposalBranding | null;
  const simulation = proposal.simulation_snapshot as unknown as SimulationData | null;
  const isAccepted = proposal.status === "accepted";
  const canSign = proposal.status === "sent" && !isAccepted;

  // Build proposal object for preview component - cast to any to avoid JSON type issues
  const proposalForPreview = {
    version: proposal.version,
    status: proposal.status as "draft" | "pending_review" | "approved" | "sent" | "accepted" | "rejected",
    branding: branding || undefined,
    executive_summary: proposal.executive_summary,
    assumptions: proposal.assumptions,
    disclaimers: proposal.disclaimers,
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div
        className="py-6 text-white"
        style={{ backgroundColor: branding?.secondary_color || "#0f172a" }}
      >
        <div className="container max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {branding?.logo_url && (
                <img src={branding.logo_url} alt="Logo" className="h-10 object-contain" />
              )}
              <div>
                <h1 className="text-xl font-bold">
                  {branding?.company_name || "Solar Proposal"}
                </h1>
                <p className="text-white/70 text-sm">
                  Proposal for {project?.name}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-white border-white/30"
              style={{ backgroundColor: branding?.primary_color || "#22c55e" }}
            >
              Version {proposal.version}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Proposal Preview */}
          <div className="lg:col-span-2">
            <ProposalPreview
              proposal={proposalForPreview}
              project={project}
              simulation={simulation || undefined}
              tenants={tenants || undefined}
              shopTypes={shopTypes || undefined}
            />
          </div>

          {/* Sidebar - Signature Panel */}
          <div className="space-y-4">
            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Proposal Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isAccepted ? (
                  <div className="text-center py-4">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-3" />
                    <h3 className="font-semibold text-green-700">Proposal Accepted</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Signed by {proposal.client_signature}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.client_signed_at && new Date(proposal.client_signed_at).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ) : proposal.status === "sent" ? (
                  <div className="text-center py-2">
                    <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                      Awaiting Your Signature
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <Badge variant="secondary">
                      {proposal.status}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Card */}
            {canSign && (
              <Card className="border-primary/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PenLine className="h-5 w-5" />
                    Sign Proposal
                  </CardTitle>
                  <CardDescription>
                    Review the proposal above and sign to accept
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-name">Your Full Name</Label>
                    <Input
                      id="client-name"
                      placeholder="Enter your full name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                      I have reviewed this proposal and agree to the terms, conditions, and disclaimers stated herein.
                    </Label>
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSign}
                    disabled={!clientName.trim() || !agreedToTerms || isSigning}
                    style={{ backgroundColor: branding?.primary_color }}
                  >
                    {isSigning ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PenLine className="mr-2 h-4 w-4" />
                    )}
                    Sign & Accept Proposal
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By signing, you acknowledge that this constitutes your electronic signature.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Contact Card */}
            {branding && (branding.contact_email || branding.contact_phone) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Questions?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {branding.contact_email && (
                    <p>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <a href={`mailto:${branding.contact_email}`} className="text-primary hover:underline">
                        {branding.contact_email}
                      </a>
                    </p>
                  )}
                  {branding.contact_phone && (
                    <p>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      <a href={`tel:${branding.contact_phone}`} className="text-primary hover:underline">
                        {branding.contact_phone}
                      </a>
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="py-4 text-white/70 text-center text-sm mt-8"
        style={{ backgroundColor: branding?.secondary_color || "#0f172a" }}
      >
        <p>
          {branding?.company_name || "Solar Solutions"} • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
