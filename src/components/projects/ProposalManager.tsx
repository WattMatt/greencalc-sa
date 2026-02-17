import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Edit, Calendar, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ProposalWorkspaceInline } from "@/components/proposals/ProposalWorkspaceInline";

interface ProposalManagerProps {
    projectId: string;
}

export function ProposalManager({ projectId }: ProposalManagerProps) {
    const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const { data: proposals, isLoading } = useQuery({
        queryKey: ["project-proposals", projectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("proposals")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved": return "bg-green-500/10 text-green-600 border-green-500/20";
            case "accepted": return "bg-green-500/10 text-green-600 border-green-500/20";
            case "sent": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
            case "pending_review": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
            case "rejected": return "bg-red-500/10 text-red-600 border-red-500/20";
            default: return "bg-muted text-muted-foreground border-muted-foreground/20";
        }
    };

    const handleEdit = (proposalId: string) => {
        setEditingProposalId(proposalId);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setEditingProposalId(null);
        setIsEditing(true);
    };

    const handleBack = () => {
        setIsEditing(false);
        setEditingProposalId(null);
    };

    if (isEditing) {
        return (
            <ProposalWorkspaceInline
                projectId={projectId}
                proposalId={editingProposalId}
                onBack={handleBack}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Proposals</h2>
                    <p className="text-sm text-muted-foreground">Manage and track proposals for this project</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Proposal
                </Button>
            </div>

            <div className="grid gap-4">
                {proposals && proposals.length > 0 ? (
                    proposals.map((proposal) => (
                        <Card key={proposal.id} className="overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex items-center justify-between p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold">Version {proposal.version}</h3>
                                                <Badge variant="outline" className={getStatusColor(proposal.status)}>
                                                    {proposal.status.replace("_", " ")}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(proposal.created_at), "MMM d, yyyy")}
                                                </span>
                                                {proposal.client_signature && (
                                                    <span className="flex items-center gap-1 text-green-600">
                                                        Signed by {proposal.client_signature}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {proposal.share_token && (proposal.status === "sent" || proposal.status === "approved" || proposal.status === "accepted") && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(`/portal/${proposal.share_token}`, '_blank')}
                                            >
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Client View
                                            </Button>
                                        )}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleEdit(proposal.id)}
                                        >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold mb-1">No proposals yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Create your first proposal to get started with client quotes.
                            </p>
                            <Button onClick={handleCreate}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Proposal
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
