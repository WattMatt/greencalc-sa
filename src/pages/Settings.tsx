import { useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Bell, Moon, Sun, Monitor, HelpCircle, RotateCcw, Zap, ExternalLink } from "lucide-react";
import { NotificationSettings } from "@/components/pwa/NotificationSettings";
import { ContentEnhancerDemo } from "@/components/onboarding/ContentEnhancerDemo";
import { APIIntegrationConfigPanel, APIIntegrationStatus } from "@/components/projects/simulation";
import { APIIntegrationConfig, defaultAPIIntegrationConfig } from "@/components/projects/simulation/APIIntegrationTypes";
import { DeratingSettingsCard } from "@/components/settings/DeratingSettingsCard";
import { useTour } from "@/components/onboarding/TourContext";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [includeVAT, setIncludeVAT] = useState(true);
  const [useAverageRates, setUseAverageRates] = useState(false);
  const { completedTours, resetAllTours } = useTour();
  const [apiConfig, setApiConfig] = useState<APIIntegrationConfig>(defaultAPIIntegrationConfig);

  const totalTours = 5;
  const completedCount = completedTours.length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure application preferences and integrations</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="derating" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Derating
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Appearance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    onClick={() => setTheme("light")}
                    className="flex-1"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    onClick={() => setTheme("dark")}
                    className="flex-1"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    onClick={() => setTheme("system")}
                    className="flex-1"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color scheme. System will follow your device settings.
                </p>
              </CardContent>
            </Card>

            {/* Calculation Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Calculation Settings</CardTitle>
                <CardDescription>Adjust default calculation parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-vat">Include VAT in calculations</Label>
                    <p className="text-xs text-muted-foreground">Add 15% VAT to all tariff calculations</p>
                  </div>
                  <Switch
                    id="include-vat"
                    checked={includeVAT}
                    onCheckedChange={setIncludeVAT}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="average-rates">Use average TOU rates</Label>
                    <p className="text-xs text-muted-foreground">Simplify TOU calculations using weighted averages</p>
                  </div>
                  <Switch
                    id="average-rates"
                    checked={useAverageRates}
                    onCheckedChange={setUseAverageRates}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Onboarding Tours */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <HelpCircle className="h-5 w-5" />
                  Onboarding Tours
                </CardTitle>
                <CardDescription>Manage guided tours and help overlays</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You have completed <span className="font-semibold text-foreground">{completedCount}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalTours}</span> available tours.
                </p>
                <Button variant="outline" onClick={resetAllTours} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Tours
                </Button>
                <p className="text-xs text-muted-foreground">
                  Resetting tours will show the onboarding guides again when you visit each simulation page.
                </p>
              </CardContent>
            </Card>

            {/* About */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">About</CardTitle>
                <CardDescription>Platform information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-foreground">Green Energy Financial Platform</p>
                    <p className="text-sm text-muted-foreground">
                      This platform helps South African users model ROI and payback periods for solar and
                      battery installations based on municipal electricity tariffs.
                    </p>
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
        </TabsContent>

        <TabsContent value="derating" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <DeratingSettingsCard />
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">About Derating</CardTitle>
                <CardDescription>Understanding derating factors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Diversity Factor:</strong> Accounts for the fact that not all loads operate at maximum simultaneously. 
                  Shopping centres typically use 80% as tenants have different peak hours.
                </p>
                <p>
                  <strong className="text-foreground">DC/AC Ratio:</strong> Oversizing PV panels relative to inverter capacity improves morning/evening generation 
                  and accounts for panel degradation.
                </p>
                <p>
                  <strong className="text-foreground">System Losses:</strong> Combined losses from inverter efficiency, wiring, mismatch, and other factors. 
                  Typically 10-14% for well-designed systems.
                </p>
                <p>
                  <strong className="text-foreground">Temperature Derating:</strong> Solar panel output decreases as temperature increases. 
                  South African conditions typically require 3-5% derating.
                </p>
                <p>
                  <strong className="text-foreground">Soiling Losses:</strong> Dust and dirt accumulation on panels. 
                  Urban areas typically 1-2%, dusty/industrial areas 3-5%.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <ContentEnhancerDemo />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <APIIntegrationConfigPanel config={apiConfig} onChange={setApiConfig} />
            <APIIntegrationStatus config={apiConfig} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
