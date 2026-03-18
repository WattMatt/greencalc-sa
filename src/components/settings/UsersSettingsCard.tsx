import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/hooks/useUserRole";
import { InviteUserForm } from "./InviteUserForm";
import { OrgMembersList } from "./OrgMembersList";
import { toast } from "sonner";
import { Loader2, Shield, Building2, Plus } from "lucide-react";

export function UsersSettingsCard() {
  const { orgId, isAdmin, isLoading, orgName, createOrganization } = useUserRole();
  const [newOrgName, setNewOrgName] = useState("WM Solar");
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Your Organization
          </CardTitle>
          <CardDescription>
            Set up your organization to start inviting team members and sharing projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                placeholder="My Company"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <Button
              onClick={async () => {
                if (!newOrgName.trim()) {
                  toast.error("Please enter an organization name");
                  return;
                }
                setCreating(true);
                const result = await createOrganization(newOrgName.trim());
                if (result) {
                  toast.success("Organization created! You are now the admin.");
                } else {
                  toast.error("Failed to create organization");
                }
                setCreating(false);
              }}
              disabled={creating}
              className="flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Organization
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {orgName || "Organization"}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "You are an administrator. You can invite members and manage roles."
              : "You are a member of this organization. Contact an admin to manage users."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Invite form (admin only) */}
      {isAdmin && <InviteUserForm orgId={orgId} />}

      {/* Members list */}
      <OrgMembersList orgId={orgId} isAdmin={isAdmin} />
    </div>
  );
}
