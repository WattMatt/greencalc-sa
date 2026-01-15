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
  };
  layout: {
    headerStyle: 'full-width' | 'centered' | 'minimal';
    sectionSpacing: number;
    useCards: boolean;
    showIcons: boolean;
    tableStyle: 'striped' | 'bordered' | 'minimal';
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
    },
    layout: {
      headerStyle: 'full-width',
      sectionSpacing: 15,
      useCards: true,
      showIcons: true,
      tableStyle: 'striped',
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
    },
    layout: {
      headerStyle: 'centered',
      sectionSpacing: 12,
      useCards: false,
      showIcons: false,
      tableStyle: 'bordered',
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
    },
    layout: {
      headerStyle: 'full-width',
      sectionSpacing: 20,
      useCards: true,
      showIcons: true,
      tableStyle: 'minimal',
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
    },
    layout: {
      headerStyle: 'minimal',
      sectionSpacing: 10,
      useCards: false,
      showIcons: false,
      tableStyle: 'minimal',
    },
  },
};
