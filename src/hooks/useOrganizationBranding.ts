import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrganizationBranding {
  id?: string;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
}

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

// Simple event emitter for branding updates
const brandingListeners: Set<() => void> = new Set();

export function notifyBrandingUpdate() {
  brandingListeners.forEach(listener => listener());
}

export function useOrganizationBranding() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<OrganizationBranding>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  const loadBranding = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("organization_branding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        // Add cache buster to logo URL to prevent stale images
        const logoUrl = data.logo_url 
          ? `${data.logo_url}?t=${Date.now()}` 
          : null;
        setBranding({
          id: data.id,
          company_name: data.company_name,
          logo_url: logoUrl,
          primary_color: data.primary_color || "#3b82f6",
          secondary_color: data.secondary_color || "#1e40af",
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          website: data.website,
          address: data.address,
        });
      }
    } catch (error) {
      console.error("Error loading organization branding:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  // Subscribe to branding updates
  useEffect(() => {
    brandingListeners.add(loadBranding);
    return () => {
      brandingListeners.delete(loadBranding);
    };
  }, [loadBranding]);

  return { branding, isLoading, refetch: loadBranding };
}