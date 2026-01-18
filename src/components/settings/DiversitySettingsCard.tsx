import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCcw, Users, Building2, Factory, Warehouse, Store, Hotel, School, Hospital, Plus, Save, Trash2 } from "lucide-react";
import { useDeratingSettings } from "@/hooks/useDeratingSettings";
import { toast } from "sonner";
import { useState } from "react";

const DIVERSITY_PRESETS = [
  { label: "Shopping Centre", value: 0.80, icon: Store, description: "Mixed retail with varying peak hours" },
  { label: "Office Park", value: 0.85, icon: Building2, description: "Consistent 9-5 demand pattern" },
  { label: "Industrial", value: 0.90, icon: Factory, description: "Production-driven, high base load" },
  { label: "Mixed Use", value: 0.75, icon: Warehouse, description: "Residential & commercial combined" },
  { label: "Hotel/Hospitality", value: 0.70, icon: Hotel, description: "24hr operations, variable occupancy" },
  { label: "Educational", value: 0.65, icon: School, description: "Semester-based, peak during classes" },
  { label: "Healthcare", value: 0.88, icon: Hospital, description: "Critical systems, consistent demand" },
];

interface CustomProfile {
  name: string;
  value: number;
}

export function DiversitySettingsCard() {
  const { settings, updateSetting } = useDeratingSettings();
  const [customProfiles, setCustomProfiles] = useState<CustomProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handlePresetClick = (value: number) => {
    updateSetting("diversityFactor", value);
    toast.success(`Diversity factor set to ${(value * 100).toFixed(0)}%`);
  };

  const handleSaveCustomProfile = () => {
    if (!newProfileName.trim()) {
      toast.error("Please enter a profile name");
      return;
    }
    const newProfile: CustomProfile = {
      name: newProfileName.trim(),
      value: settings.diversityFactor,
    };
    setCustomProfiles([...customProfiles, newProfile]);
    setNewProfileName("");
    setShowAddForm(false);
    toast.success(`Profile "${newProfile.name}" saved at ${(newProfile.value * 100).toFixed(0)}%`);
  };

  const handleDeleteCustomProfile = (index: number) => {
    const profileName = customProfiles[index].name;
    setCustomProfiles(customProfiles.filter((_, i) => i !== index));
    toast.success(`Profile "${profileName}" deleted`);
  };

  const handleResetToDefault = () => {
    updateSetting("diversityFactor", 0.80);
    toast.success("Diversity factor reset to 80%");
  };

  return (
    <div className="space-y-6">
      {/* Current Value Display */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Users className="h-5 w-5" />
            Diversity Factor Configuration
          </CardTitle>
          <CardDescription>
            The diversity factor accounts for the fact that not all electrical loads operate at maximum demand simultaneously
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Current Diversity Factor</Label>
              <span className="text-3xl font-bold text-primary">{(settings.diversityFactor * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[settings.diversityFactor * 100]}
              onValueChange={([v]) => updateSetting("diversityFactor", v / 100)}
              min={50}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50% (High Diversity)</span>
              <span>75%</span>
              <span>100% (No Diversity)</span>
            </div>
          </div>

          {/* Impact Summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium text-foreground">Impact Summary</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Peak Demand Reduction</p>
                <p className="font-semibold text-foreground">{((1 - settings.diversityFactor) * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Effective Load Factor</p>
                <p className="font-semibold text-foreground">{settings.diversityFactor.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A {(settings.diversityFactor * 100).toFixed(0)}% diversity factor means combined peak demand is reduced 
              by {((1 - settings.diversityFactor) * 100).toFixed(0)}% compared to the sum of individual peaks.
            </p>
          </div>

          <Button variant="outline" onClick={handleResetToDefault} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default (80%)
          </Button>
        </CardContent>
      </Card>

      {/* Preset Profiles */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Building Type Presets</CardTitle>
          <CardDescription>
            Industry-standard diversity factors for common building types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {DIVERSITY_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = Math.abs(settings.diversityFactor - preset.value) < 0.01;
              return (
                <Button
                  key={preset.label}
                  variant={isActive ? "default" : "outline"}
                  className="h-auto py-3 px-4 flex flex-col items-start gap-1 text-left"
                  onClick={() => handlePresetClick(preset.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium flex-1">{preset.label}</span>
                    <span className="text-sm opacity-80">{(preset.value * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs opacity-70 font-normal">{preset.description}</p>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Profiles */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Custom Profiles</CardTitle>
          <CardDescription>
            Save your own diversity factor profiles for quick access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customProfiles.length > 0 && (
            <div className="grid gap-2">
              {customProfiles.map((profile, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                  <Button
                    variant={Math.abs(settings.diversityFactor - profile.value) < 0.01 ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 justify-start"
                    onClick={() => handlePresetClick(profile.value)}
                  >
                    {profile.name} ({(profile.value * 100).toFixed(0)}%)
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCustomProfile(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showAddForm ? (
            <div className="flex gap-2">
              <Input
                placeholder="Profile name..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSaveCustomProfile()}
              />
              <Button onClick={handleSaveCustomProfile} size="icon">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Save Current as Profile ({(settings.diversityFactor * 100).toFixed(0)}%)
            </Button>
          )}

          {customProfiles.length === 0 && !showAddForm && (
            <p className="text-xs text-muted-foreground text-center">
              No custom profiles saved yet. Adjust the slider and save a profile for quick access.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}