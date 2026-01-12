// Shared types for CSV import to avoid circular dependencies

export interface ColumnConfig {
  index: number;
  name: string;
  dataType: "general" | "text" | "date" | "skip";
  dateFormat?: string;
}

export interface WizardParseConfig {
  fileType: "delimited" | "fixed";
  startRow: number;
  delimiters: {
    tab: boolean;
    semicolon: boolean;
    comma: boolean;
    space: boolean;
    other: boolean;
    otherChar: string;
  };
  treatConsecutiveAsOne: boolean;
  textQualifier: string;
  columns: ColumnConfig[];
  detectedFormat?: "pnp-scada" | "generic";
  meterName?: string;
  dateRange?: { start: string; end: string };
}

export interface ParsedData {
  headers: string[];
  rows: string[][];
  meterName?: string;
  dateRange?: { start: string; end: string };
}
