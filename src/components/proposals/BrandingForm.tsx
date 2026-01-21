import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, Palette, Mail, Phone, Globe, MapPin, Sparkles, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProposalBranding } from "./types";

interface BrandingFormProps {
  branding: ProposalBranding;
  onChange: (branding: ProposalBranding) => void;
  disabled?: boolean;
  autoPopulated?: boolean;
}

export function BrandingForm({ branding, onChange, disabled, autoPopulated }: BrandingFormProps) {
  const update = (field: keyof ProposalBranding, value: string) => {
    onChange({ ...branding, [field]: value || null });
  };

  const hasOrgBranding = !!branding.company_name;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Company Branding</CardTitle>
          </div>
          {hasOrgBranding && autoPopulated && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/30 text-primary bg-primary/5">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              From Settings
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center justify-between">
          <span>
            {hasOrgBranding 
              ? "Auto-filled from your organization settings" 
              : "Add your company details to the proposal"
            }
          </span>
          {!hasOrgBranding && (
            <Link 
              to="/settings" 
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Set up in Settings
            </Link>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name</Label>
          <Input
            id="company_name"
            placeholder="Your Company Name"
            value={branding.company_name || ""}
            onChange={(e) => update("company_name", e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Logo URL */}
        <div className="space-y-2">
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input
            id="logo_url"
            placeholder="https://example.com/logo.png"
            value={branding.logo_url || ""}
            onChange={(e) => update("logo_url", e.target.value)}
            disabled={disabled}
          />
          {branding.logo_url && (
            <div className="p-2 border rounded-md bg-muted/30">
              <img
                src={branding.logo_url}
                alt="Company logo preview"
                className="h-12 object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Primary Color
            </Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="primary_color"
                value={branding.primary_color}
                onChange={(e) => update("primary_color", e.target.value)}
                disabled={disabled}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.primary_color}
                onChange={(e) => update("primary_color", e.target.value)}
                disabled={disabled}
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
                onChange={(e) => update("secondary_color", e.target.value)}
                disabled={disabled}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.secondary_color}
                onChange={(e) => update("secondary_color", e.target.value)}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contact_email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="info@company.com"
              value={branding.contact_email || ""}
              onChange={(e) => update("contact_email", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone
            </Label>
            <Input
              id="contact_phone"
              placeholder="+27 11 123 4567"
              value={branding.contact_phone || ""}
              onChange={(e) => update("contact_phone", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Website
          </Label>
          <Input
            id="website"
            placeholder="https://www.company.com"
            value={branding.website || ""}
            onChange={(e) => update("website", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Textarea
            id="address"
            placeholder="123 Main Street, Johannesburg, 2000"
            value={branding.address || ""}
            onChange={(e) => update("address", e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
