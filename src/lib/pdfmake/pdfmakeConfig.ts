import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfmake with virtual file system fonts
pdfMake.vfs = pdfFonts.vfs;

// Color palette for consistent styling
export const COLORS = {
  primary: "#22c55e",      // Emerald green
  primaryDark: "#16a34a",
  secondary: "#0f172a",     // Slate dark
  accent: "#3b82f6",        // Blue
  warning: "#f59e0b",       // Amber
  danger: "#ef4444",        // Red
  muted: "#64748b",
  background: "#f8fafc",
  white: "#ffffff",
  black: "#000000",
};

// Typography defaults
export const TYPOGRAPHY = {
  headingFont: "Roboto",
  bodyFont: "Roboto",
};

// Common styles for reuse
export const defaultStyles = {
  header: {
    fontSize: 24,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10] as [number, number, number, number],
  },
  subheader: {
    fontSize: 16,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 10, 0, 5] as [number, number, number, number],
  },
  sectionTitle: {
    fontSize: 14,
    bold: true,
    color: COLORS.primaryDark,
    margin: [0, 15, 0, 8] as [number, number, number, number],
  },
  bodyText: {
    fontSize: 10,
    color: COLORS.secondary,
    lineHeight: 1.4,
  },
  smallText: {
    fontSize: 8,
    color: COLORS.muted,
  },
  tableHeader: {
    bold: true,
    fontSize: 9,
    color: COLORS.white,
    fillColor: COLORS.primary,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.secondary,
  },
  metricValue: {
    fontSize: 18,
    bold: true,
    color: COLORS.primary,
  },
  metricLabel: {
    fontSize: 8,
    color: COLORS.muted,
  },
  aiBadge: {
    fontSize: 6,
    color: COLORS.primaryDark,
    fillColor: "#dcfce7",
  },
};

// Helper to convert hex color to rgb array for pdfmake
export const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
};

// Load image as base64 for embedding
export const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Format currency
export const formatCurrency = (value: number, abbreviate = false): string => {
  if (abbreviate) {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
  }
  return `R${value.toLocaleString()}`;
};

// Format number with locale
export const formatNumber = (value: number, decimals = 0): string => {
  return value.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

export { pdfMake };
