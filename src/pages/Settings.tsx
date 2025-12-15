import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Info, RotateCcw, HelpCircle, Sun, Moon, Monitor } from "lucide-react";
import { useTour, TOURS } from "@/components/onboarding";
import { useTheme } from "next-themes";
import { toast } from "sonner";

export default function Settings() {
  const { completedTours, resetAllTours } = useTour();
  const { theme, setTheme } = useTheme();

  const handleResetTours = () => {
    resetAllTours();
    toast.success("All tours have been reset. They will appear again when you visit each page.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure application preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Theme Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs">Light</span>
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs">Dark</span>
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setTheme("system")}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs">System</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color scheme. System will follow your device settings.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Calculation Settings</CardTitle>
            <CardDescription>Adjust default calculation parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include VAT in calculations</Label>
                <p className="text-sm text-muted-foreground">
                  Add 15% VAT to all tariff calculations
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Use average TOU rates</Label>
                <p className="text-sm text-muted-foreground">
                  Simplify TOU calculations using weighted averages
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <HelpCircle className="h-5 w-5" />
              Onboarding Tours
            </CardTitle>
            <CardDescription>Manage guided tours and help overlays</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-accent/50">
              <p className="text-sm text-muted-foreground">
                {completedTours.length === 0 ? (
                  "No tours completed yet. Visit simulation pages to see guided tours."
                ) : (
                  <>
                    You have completed <strong>{completedTours.length}</strong> of{" "}
                    <strong>{Object.keys(TOURS).length}</strong> available tours.
                  </>
                )}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleResetTours}
              disabled={completedTours.length === 0}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All Tours
            </Button>
            <p className="text-xs text-muted-foreground">
              Resetting tours will show the onboarding guides again when you visit each simulation page.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">About</CardTitle>
            <CardDescription>Platform information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-accent/50">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Green Energy Financial Platform</p>
                  <p className="text-sm text-muted-foreground">
                    This platform helps South African users model ROI and payback periods 
                    for solar and battery installations based on municipal electricity tariffs.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Data Source:</strong> Municipal tariff schedules</p>
              <p><strong>Last Updated:</strong> 2024/2025 Financial Year</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
