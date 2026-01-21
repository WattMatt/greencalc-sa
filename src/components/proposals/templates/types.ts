// Proposal template definitions and types

export type ProposalTemplateId = 'modern' | 'classic' | 'premium' | 'minimal';

export interface ProposalTemplate {
  id: ProposalTemplateId;
  name: string;
  description: string;
  preview: string; // Description of the template style
  colors: {
    headerBg: string;
    accentColor: string;
    textPrimary: string;
    textSecondary: string;
    cardBg: string;
    tableBorder: string;
  };
  typography: {
    headingFont: 'helvetica' | 'times' | 'courier';
    bodyFont: 'helvetica' | 'times' | 'courier';
    headingSizes: {
      h1: number;
      h2: number;
      h3: number;
    };
    bodySize: number;
    headingWeight: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  };
  layout: {
    headerStyle: 'full-width' | 'centered' | 'minimal';
    sectionSpacing: 'compact' | 'normal' | 'relaxed' | 'spacious';
    cardStyle: 'rounded' | 'sharp' | 'subtle' | 'none';
    useCards: boolean;
    showIcons: boolean;
    tableStyle: 'striped' | 'bordered' | 'minimal';
    borderWidth: 'none' | 'thin' | 'medium' | 'thick';
    shadowStyle: 'none' | 'subtle' | 'medium' | 'pronounced';
  };
}

// Helper to get Tailwind classes from template settings
export function getTemplateStyles(template: ProposalTemplate) {
  // Section spacing
  const sectionSpacingMap = {
    compact: { gap: 'gap-3', mb: 'mb-4', p: 'p-3' },
    normal: { gap: 'gap-4', mb: 'mb-6', p: 'p-4' },
    relaxed: { gap: 'gap-6', mb: 'mb-8', p: 'p-5' },
    spacious: { gap: 'gap-8', mb: 'mb-10', p: 'p-6' },
  };

  // Card border radius
  const cardRadiusMap = {
    rounded: 'rounded-xl',
    sharp: 'rounded-none',
    subtle: 'rounded-md',
    none: 'rounded-none border-0',
  };

  // Heading weight
  const headingWeightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
  };

  // Border width
  const borderWidthMap = {
    none: 'border-0',
    thin: 'border',
    medium: 'border-2',
    thick: 'border-4',
  };

  // Shadow style
  const shadowMap = {
    none: 'shadow-none',
    subtle: 'shadow-sm',
    medium: 'shadow-md',
    pronounced: 'shadow-lg',
  };

  return {
    sectionSpacing: sectionSpacingMap[template.layout.sectionSpacing],
    cardRadius: cardRadiusMap[template.layout.cardStyle],
    headingWeight: headingWeightMap[template.typography.headingWeight],
    borderWidth: borderWidthMap[template.layout.borderWidth],
    shadow: shadowMap[template.layout.shadowStyle],
  };
}

export const PROPOSAL_TEMPLATES: Record<ProposalTemplateId, ProposalTemplate> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with bold accents',
    preview: 'Full-width colored headers, card-based sections, gradient accents',
    colors: {
      headerBg: '#0f172a',
      accentColor: '#22c55e',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      cardBg: '#f8fafc',
      tableBorder: '#e2e8f0',
    },
    typography: {
      headingFont: 'helvetica',
      bodyFont: 'helvetica',
      headingSizes: { h1: 24, h2: 16, h3: 14 },
      bodySize: 10,
      headingWeight: 'bold',
    },
    layout: {
      headerStyle: 'full-width',
      sectionSpacing: 'normal',
      cardStyle: 'rounded',
      useCards: true,
      showIcons: true,
      tableStyle: 'striped',
      borderWidth: 'medium',
      shadowStyle: 'medium',
    },
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional professional report style',
    preview: 'Serif fonts, formal layout, traditional borders',
    colors: {
      headerBg: '#1a365d',
      accentColor: '#2b6cb0',
      textPrimary: '#1a202c',
      textSecondary: '#4a5568',
      cardBg: '#ffffff',
      tableBorder: '#cbd5e0',
    },
    typography: {
      headingFont: 'times',
      bodyFont: 'times',
      headingSizes: { h1: 22, h2: 14, h3: 12 },
      bodySize: 11,
      headingWeight: 'semibold',
    },
    layout: {
      headerStyle: 'centered',
      sectionSpacing: 'compact',
      cardStyle: 'sharp',
      useCards: false,
      showIcons: false,
      tableStyle: 'bordered',
      borderWidth: 'thin',
      shadowStyle: 'none',
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Luxury design for high-value proposals',
    preview: 'Elegant typography, gold accents, executive appeal',
    colors: {
      headerBg: '#18181b',
      accentColor: '#d97706',
      textPrimary: '#18181b',
      textSecondary: '#52525b',
      cardBg: '#fafaf9',
      tableBorder: '#d4d4d8',
    },
    typography: {
      headingFont: 'helvetica',
      bodyFont: 'helvetica',
      headingSizes: { h1: 26, h2: 18, h3: 14 },
      bodySize: 10,
      headingWeight: 'extrabold',
    },
    layout: {
      headerStyle: 'full-width',
      sectionSpacing: 'spacious',
      cardStyle: 'subtle',
      useCards: true,
      showIcons: true,
      tableStyle: 'minimal',
      borderWidth: 'thick',
      shadowStyle: 'pronounced',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple, clean, content-focused design',
    preview: 'Lots of whitespace, subtle accents, no distractions',
    colors: {
      headerBg: '#ffffff',
      accentColor: '#059669',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      cardBg: '#ffffff',
      tableBorder: '#e5e7eb',
    },
    typography: {
      headingFont: 'helvetica',
      bodyFont: 'helvetica',
      headingSizes: { h1: 20, h2: 14, h3: 12 },
      bodySize: 10,
      headingWeight: 'medium',
    },
    layout: {
      headerStyle: 'minimal',
      sectionSpacing: 'relaxed',
      cardStyle: 'none',
      useCards: false,
      showIcons: false,
      tableStyle: 'minimal',
      borderWidth: 'none',
      shadowStyle: 'none',
    },
  },
};
