import { useState, useEffect } from "react";
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

export function useOrganizationBranding() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<OrganizationBranding>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

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
        console.error("Error loading organization branding:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBranding();
  }, [user]);

  return { branding, isLoading };
}