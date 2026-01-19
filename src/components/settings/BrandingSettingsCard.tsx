import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, Loader2, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { notifyBrandingUpdate, OrganizationBranding } from "@/hooks/useOrganizationBranding";

const defaultBranding: OrganizationBranding = {
  company_name: null,
  logo_url: null,
  primary_color: "#3b82f6",
  secondary_color: "#1e40af",
  contact_email: null,
  contact_phone: null,
  website: null,
  address: null,
};

export function BrandingSettingsCard() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<OrganizationBranding>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load branding on mount
  useEffect(() => {
    if (!user) return;
    
    const loadBranding = async () => {
      try {
        const { data, error } = await supabase
          .from("organization_branding")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setBranding({
            id: data.id,
            company_name: data.company_name,
            logo_url: data.logo_url,
            primary_color: data.primary_color || "#3b82f6",
            secondary_color: data.secondary_color || "#1e40af",
            contact_email: data.contact_email,
            contact_phone: data.contact_phone,
            website: data.website,
            address: data.address,
          });
        }
      } catch (error) {
        console.error("Error loading branding:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBranding();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (branding.logo_url) {
        const oldPath = branding.logo_url.split("/branding/")[1];
        if (oldPath) {
          await supabase.storage.from("branding").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("branding")
        .getPublicUrl(fileName);

      // Update state with cache buster
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      setBranding((prev) => ({ ...prev, logo_url: urlWithCacheBuster }));
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!user || !branding.logo_url) return;

    setIsUploading(true);
    try {
      const path = branding.logo_url.split("/branding/")[1]?.split("?")[0];
      if (path) {
        await supabase.storage.from("branding").remove([path]);
      }
      setBranding((prev) => ({ ...prev, logo_url: null }));
      toast.success("Logo removed");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Failed to remove logo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        company_name: branding.company_name,
        logo_url: branding.logo_url?.split("?")[0] || null, // Remove cache buster
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        contact_email: branding.contact_email,
        contact_phone: branding.contact_phone,
        website: branding.website,
        address: branding.address,
      };

      const { error } = await supabase
        .from("organization_branding")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      notifyBrandingUpdate(); // Notify other components to refetch
      toast.success("Branding settings saved");
    } catch (error) {
      console.error("Error saving branding:", error);
      toast.error("Failed to save branding settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof OrganizationBranding, value: string) => {
    setBranding((prev) => ({ ...prev, [field]: value || null }));
  };

  if (!user) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Building2 className="h-5 w-5" />
            Company Branding
          </CardTitle>
          <CardDescription>
            Please log in to configure your company branding
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Building2 className="h-5 w-5" />
          Company Branding
        </CardTitle>
        <CardDescription>
          Set your company logo and branding. This will be used as the default for all proposals and reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 overflow-hidden">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt="Company logo"
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).alt = "Failed to load";
                  }}
                />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Logo
              </Button>
              {branding.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={isUploading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                PNG, JPG or SVG. Max 2MB. Recommended: 400x400px or larger.
              </p>
            </div>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name</Label>
          <Input
            id="company_name"
            placeholder="Your Company Name"
            value={branding.company_name || ""}
            onChange={(e) => updateField("company_name", e.target.value)}
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="primary_color"
                value={branding.primary_color}
                onChange={(e) => updateField("primary_color", e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.primary_color}
                onChange={(e) => updateField("primary_color", e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary_color">Secondary Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="secondary_color"
                value={branding.secondary_color}
                onChange={(e) => updateField("secondary_color", e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.secondary_color}
                onChange={(e) => updateField("secondary_color", e.target.value)}
                placeholder="#1e40af"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="info@company.com"
              value={branding.contact_email || ""}
              onChange={(e) => updateField("contact_email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              placeholder="+27 12 345 6789"
              value={branding.contact_phone || ""}
              onChange={(e) => updateField("contact_phone", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            placeholder="https://www.company.com"
            value={branding.website || ""}
            onChange={(e) => updateField("website", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            placeholder="123 Main Street, City, Country"
            value={branding.address || ""}
            onChange={(e) => updateField("address", e.target.value)}
          />
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Save Branding Settings
        </Button>
      </CardContent>
    </Card>
  );
}