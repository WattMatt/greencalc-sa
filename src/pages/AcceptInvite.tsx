import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase automatically picks up the token from the URL hash
    // and creates a session via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const meta = session.user.user_metadata;
          setUserName(meta?.full_name || "");
          setSessionReady(true);
          setCheckingSession(false);

          // Mark the invitation as accepted
          if (meta?.org_id) {
            await (supabase
              .from("organization_members" as any) as any)
              .update({ accepted_at: new Date().toISOString() })
              .eq("user_id", session.user.id)
              .eq("org_id", meta.org_id);
          }
        } else if (event === "TOKEN_REFRESHED") {
          // Session already exists
          setCheckingSession(false);
        }
      }
    );

    // Also check if there's already a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        setUserName(meta?.full_name || "");
        setSessionReady(true);
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast.success("Password set successfully! Redirecting...");

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invalid or Expired Link</CardTitle>
            <CardDescription>
              This invitation link may have expired or already been used.
              Please contact your organization admin for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/auth")} variant="outline">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Welcome to WM Solar!</CardTitle>
            <CardDescription>
              Your account is ready. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome{userName ? `, ${userName}` : ""}!</CardTitle>
          <CardDescription>
            You've been invited to join WM Solar. Set your password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Setting password...
                </>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
