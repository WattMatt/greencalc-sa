/**
 * PageWrapper - Provides consistent page structure for proposal sections
 * Matches the PDF output styling for true WYSIWYG
 */
import React from "react";
import { cn } from "@/lib/utils";
import { ProposalBranding } from "../types";
import { ProposalTemplate } from "../templates/types";

interface PageWrapperProps {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  template: ProposalTemplate;
  branding?: ProposalBranding;
  pageTitle?: string;
  forPDF?: boolean;
}

export function PageWrapper({
  children,
  pageNumber,
  totalPages,
  template,
  branding,
  pageTitle,
  forPDF = false,
}: PageWrapperProps) {
  const primaryColor = branding?.primary_color || template.colors.accentColor;
  const secondaryColor = branding?.secondary_color || template.colors.headerBg;
  
  // Determine if header is light (for text contrast)
  const isLightHeader = secondaryColor === '#ffffff' || 
                        secondaryColor === '#f8fafc' || 
                        secondaryColor === '#fafaf9' ||
                        secondaryColor.toLowerCase() === '#fff';
  
  const headerTextClass = isLightHeader ? 'text-foreground' : 'text-white';
  const headerSubtextClass = isLightHeader ? 'text-muted-foreground' : 'text-white/70';

  // Template-based styling
  const borderRadius = template.layout.cardStyle === 'rounded' ? '0.75rem' : 
                       template.layout.cardStyle === 'subtle' ? '0.375rem' : '0';

  return (
    <div className="flex flex-col h-full min-h-[297mm]">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ 
          backgroundColor: secondaryColor,
          borderTopLeftRadius: forPDF ? '0' : borderRadius,
          borderTopRightRadius: forPDF ? '0' : borderRadius,
        }}
      >
        <div className="flex items-center gap-3">
          {branding?.logo_url && (
            <img 
              src={`${branding.logo_url}${branding.logo_url.includes('?') ? '&' : '?'}t=${Date.now()}`}
              alt="Logo"
              className="h-8 object-contain"
            />
          )}
          <div>
            <div className={cn("text-sm font-semibold", headerTextClass)}>
              {branding?.company_name || 'Solar Proposal'}
            </div>
            {pageTitle && (
              <div className={cn("text-xs", headerSubtextClass)}>
                {pageTitle}
              </div>
            )}
          </div>
        </div>
        <div className={cn("text-xs", headerSubtextClass)}>
          Page {pageNumber} of {totalPages}
        </div>
      </div>

      {/* Accent Bar */}
      <div 
        className="h-1 shrink-0"
        style={{ backgroundColor: primaryColor }}
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto bg-background">
        {children}
      </div>

      {/* Footer */}
      <div 
        className="px-6 py-3 shrink-0 border-t bg-muted/30"
        style={{
          borderBottomLeftRadius: forPDF ? '0' : borderRadius,
          borderBottomRightRadius: forPDF ? '0' : borderRadius,
        }}
      >
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          {branding?.contact_email && (
            <span>{branding.contact_email}</span>
          )}
          {branding?.contact_phone && (
            <>
              {branding?.contact_email && <span>•</span>}
              <span>{branding.contact_phone}</span>
            </>
          )}
          {branding?.website && (
            <>
              {(branding?.contact_email || branding?.contact_phone) && <span>•</span>}
              <span>{branding.website}</span>
            </>
          )}
          {!branding?.contact_email && !branding?.contact_phone && !branding?.website && (
            <span>Proposal generated on {new Date().toLocaleDateString("en-ZA")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
