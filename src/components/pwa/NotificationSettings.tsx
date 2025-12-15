import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, BellRing, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferences {
  simulationComplete: boolean;
  proposalStatus: boolean;
  systemAlerts: boolean;
  weeklyReport: boolean;
}

const defaultPreferences: NotificationPreferences = {
  simulationComplete: true,
  proposalStatus: true,
  systemAlerts: true,
  weeklyReport: false,
};

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Load saved preferences
    const saved = localStorage.getItem("notification-preferences");
    if (saved) {
      setPreferences(JSON.parse(saved));
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error("Notifications not supported in this browser");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast.success("Notifications enabled!");
        // Send test notification
        new Notification("Green Energy Platform", {
          body: "You'll now receive notifications for important updates",
          icon: "/icons/icon-192x192.png",
        });
      } else if (result === "denied") {
        toast.error("Notifications blocked. You can enable them in browser settings.");
      }
    } catch (error) {
      toast.error("Failed to request notification permission");
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    localStorage.setItem("notification-preferences", JSON.stringify(updated));
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case "granted":
        return (
          <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="h-3 w-3" />
            Enabled
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Blocked
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Not set
          </Badge>
        );
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Notifications are not supported in this browser
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences for important updates
            </CardDescription>
          </div>
          {getPermissionBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {permission !== "granted" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              Enable notifications to receive alerts about simulation results, proposal updates, and system events.
            </p>
            <Button onClick={requestPermission} disabled={permission === "denied"}>
              <BellRing className="h-4 w-4 mr-2" />
              {permission === "denied" ? "Blocked in Browser" : "Enable Notifications"}
            </Button>
            {permission === "denied" && (
              <p className="text-xs text-muted-foreground mt-2">
                To enable, go to your browser settings and allow notifications for this site.
              </p>
            )}
          </div>
        )}

        {permission === "granted" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sim-complete">Simulation Complete</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when simulations finish running
                </p>
              </div>
              <Switch
                id="sim-complete"
                checked={preferences.simulationComplete}
                onCheckedChange={(checked) => updatePreference("simulationComplete", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="proposal-status">Proposal Updates</Label>
                <p className="text-xs text-muted-foreground">
                  Alerts for proposal approvals and signatures
                </p>
              </div>
              <Switch
                id="proposal-status"
                checked={preferences.proposalStatus}
                onCheckedChange={(checked) => updatePreference("proposalStatus", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="system-alerts">System Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Important system notifications and errors
                </p>
              </div>
              <Switch
                id="system-alerts"
                checked={preferences.systemAlerts}
                onCheckedChange={(checked) => updatePreference("systemAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-report">Weekly Digest</Label>
                <p className="text-xs text-muted-foreground">
                  Summary of project activity each week
                </p>
              </div>
              <Switch
                id="weekly-report"
                checked={preferences.weeklyReport}
                onCheckedChange={(checked) => updatePreference("weeklyReport", checked)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
