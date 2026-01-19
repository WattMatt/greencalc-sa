import type { Content, ContentTable, TableCell, ContentColumns } from "pdfmake/interfaces";
import { COLORS, formatCurrency, formatNumber } from "./pdfmakeConfig";

// ============= TABLE STYLES =============

export interface TableStyleOptions {
  headerColor?: string;
  headerTextColor?: string;
  alternateRowColor?: string;
  borderColor?: string;
  fontSize?: number;
  headerFontSize?: number;
}

const defaultTableStyles: TableStyleOptions = {
  headerColor: COLORS.primary,
  headerTextColor: COLORS.white,
  alternateRowColor: "#f9fafb",
  borderColor: "#e5e7eb",
  fontSize: 9,
  headerFontSize: 9,
};

// ============= BASIC TABLE =============

export interface BasicTableOptions extends TableStyleOptions {
  widths?: (string | number)[];
  headerAlignment?: "left" | "center" | "right";
}

/**
 * Creates a basic table with header row styling
 */
export function createBasicTable(
  headers: string[],
  rows: (string | number)[][],
  options: BasicTableOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };
  const widths = options.widths || headers.map(() => "*");

  const headerRow: TableCell[] = headers.map((header) => ({
    text: header,
    style: "tableHeader",
    fillColor: styles.headerColor,
    color: styles.headerTextColor,
    fontSize: styles.headerFontSize,
    bold: true,
    alignment: options.headerAlignment || "left",
    margin: [5, 8, 5, 8] as [number, number, number, number],
  }));

  const bodyRows: TableCell[][] = rows.map((row, rowIndex) =>
    row.map((cell) => ({
      text: String(cell),
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [5, 6, 5, 6] as [number, number, number, number],
    }))
  );

  return {
    table: {
      headerRows: 1,
      widths,
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= KEY-VALUE TABLE =============

export interface KeyValueTableOptions extends TableStyleOptions {
  keyWidth?: string | number;
  valueWidth?: string | number;
  keyBold?: boolean;
}

/**
 * Creates a two-column key-value table (like a definition list)
 */
export function createKeyValueTable(
  items: Array<{ key: string; value: string | number }>,
  options: KeyValueTableOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };
  const keyWidth = options.keyWidth || 150;
  const valueWidth = options.valueWidth || "*";

  const bodyRows: TableCell[][] = items.map((item, index) => [
    {
      text: item.key,
      fontSize: styles.fontSize,
      bold: options.keyBold !== false,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [8, 6, 5, 6] as [number, number, number, number],
    },
    {
      text: String(item.value),
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [5, 6, 8, 6] as [number, number, number, number],
    },
  ]);

  return {
    table: {
      widths: [keyWidth, valueWidth],
      body: bodyRows,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= COMPARISON TABLE =============

export interface ComparisonTableOptions extends TableStyleOptions {
  positiveColor?: string;
  negativeColor?: string;
  showDifferenceColumn?: boolean;
}

/**
 * Creates a comparison table with before/after columns and optional difference
 */
export function createComparisonTable(
  headers: [string, string, string, string?], // [Metric, Before, After, Difference?]
  rows: Array<{
    metric: string;
    before: string | number;
    after: string | number;
    difference?: string | number;
    isPositive?: boolean;
  }>,
  options: ComparisonTableOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };
  const positiveColor = options.positiveColor || COLORS.primary;
  const negativeColor = options.negativeColor || COLORS.danger;
  const showDiff = options.showDifferenceColumn !== false && headers.length === 4;

  const widths = showDiff ? ["*", "auto", "auto", "auto"] : ["*", "auto", "auto"];
  const actualHeaders = showDiff ? headers : headers.slice(0, 3);

  const headerRow: TableCell[] = actualHeaders.map((header) => ({
    text: header || "",
    style: "tableHeader",
    fillColor: styles.headerColor,
    color: styles.headerTextColor,
    fontSize: styles.headerFontSize,
    bold: true,
    alignment: "center" as const,
    margin: [8, 8, 8, 8] as [number, number, number, number],
  }));

  const bodyRows: TableCell[][] = rows.map((row, rowIndex) => {
    const cells: TableCell[] = [
      {
        text: row.metric,
        fontSize: styles.fontSize,
        bold: true,
        color: COLORS.secondary,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        margin: [8, 6, 5, 6] as [number, number, number, number],
      },
      {
        text: String(row.before),
        fontSize: styles.fontSize,
        color: COLORS.muted,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        alignment: "right" as const,
        margin: [5, 6, 8, 6] as [number, number, number, number],
      },
      {
        text: String(row.after),
        fontSize: styles.fontSize,
        color: COLORS.secondary,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        alignment: "right" as const,
        margin: [5, 6, 8, 6] as [number, number, number, number],
      },
    ];

    if (showDiff && row.difference !== undefined) {
      cells.push({
        text: String(row.difference),
        fontSize: styles.fontSize,
        bold: true,
        color: row.isPositive !== false ? positiveColor : negativeColor,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        alignment: "right" as const,
        margin: [5, 6, 8, 6] as [number, number, number, number],
      });
    }

    return cells;
  });

  return {
    table: {
      headerRows: 1,
      widths,
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= METRICS GRID =============

export interface MetricCardOptions {
  primaryColor?: string;
  backgroundColor?: string;
}

/**
 * Creates a grid of metric cards (value + label pairs)
 */
export function createMetricsGrid(
  metrics: Array<{ label: string; value: string | number; unit?: string }>,
  columnsPerRow: 2 | 3 | 4 = 2,
  options: MetricCardOptions = {}
): Content[] {
  const primaryColor = options.primaryColor || COLORS.primary;
  const backgroundColor = options.backgroundColor || "#f9fafb";

  const rows: Content[] = [];
  
  for (let i = 0; i < metrics.length; i += columnsPerRow) {
    const rowMetrics = metrics.slice(i, i + columnsPerRow);
    
    const columns: Content[] = rowMetrics.map((metric) => ({
      stack: [
        {
          text: metric.unit ? `${metric.value} ${metric.unit}` : String(metric.value),
          fontSize: 16,
          bold: true,
          color: primaryColor,
          margin: [10, 8, 10, 2] as [number, number, number, number],
        },
        {
          text: metric.label,
          fontSize: 8,
          color: COLORS.muted,
          margin: [10, 0, 10, 8] as [number, number, number, number],
        },
      ],
      margin: [0, 0, 5, 5] as [number, number, number, number],
    }));

    // Fill remaining columns if row is not complete
    while (columns.length < columnsPerRow) {
      columns.push({ text: "" });
    }

    rows.push({
      columns,
      columnGap: 10,
    } as ContentColumns);
  }

  return rows;
}

// ============= FINANCIAL TABLE =============

/**
 * Creates a financial summary table with currency formatting
 */
export function createFinancialTable(
  items: Array<{
    label: string;
    value: number;
    format?: "currency" | "percentage" | "years" | "number";
    highlight?: boolean;
  }>,
  options: TableStyleOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };

  const formatValue = (value: number, format?: string): string => {
    switch (format) {
      case "currency":
        return formatCurrency(value);
      case "percentage":
        return `${formatNumber(value, 1)}%`;
      case "years":
        return `${formatNumber(value, 1)} years`;
      default:
        return formatNumber(value);
    }
  };

  const bodyRows: TableCell[][] = items.map((item, index) => [
    {
      text: item.label,
      fontSize: styles.fontSize,
      bold: item.highlight,
      color: item.highlight ? styles.headerColor : COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [8, 6, 5, 6] as [number, number, number, number],
    },
    {
      text: formatValue(item.value, item.format),
      fontSize: styles.fontSize,
      bold: item.highlight,
      color: item.highlight ? styles.headerColor : COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "right" as const,
      margin: [5, 6, 8, 6] as [number, number, number, number],
    },
  ]);

  return {
    table: {
      widths: ["*", "auto"],
      body: bodyRows,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= CASHFLOW TABLE =============

/**
 * Creates a cashflow projection table with year-by-year breakdown
 */
export function createCashflowTable(
  cashflows: Array<{
    year: number;
    cumulative_savings: number;
    cumulative_cost: number;
    net_position: number;
  }>,
  options: TableStyleOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };

  const headerRow: TableCell[] = [
    {
      text: "Year",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Cumulative Savings",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      alignment: "right" as const,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Net Position",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      alignment: "right" as const,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Status",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      alignment: "center" as const,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
  ];

  const bodyRows: TableCell[][] = cashflows.map((cf, index) => [
    {
      text: cf.year.toString(),
      fontSize: styles.fontSize,
      bold: true,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [8, 5, 5, 5] as [number, number, number, number],
    },
    {
      text: formatCurrency(cf.cumulative_savings),
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "right" as const,
      margin: [5, 5, 8, 5] as [number, number, number, number],
    },
    {
      text: formatCurrency(cf.net_position),
      fontSize: styles.fontSize,
      color: cf.net_position >= 0 ? COLORS.primary : COLORS.danger,
      bold: cf.net_position >= 0,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "right" as const,
      margin: [5, 5, 8, 5] as [number, number, number, number],
    },
    {
      text: cf.net_position >= 0 ? "✓ Profit" : "Investment",
      fontSize: styles.fontSize,
      color: cf.net_position >= 0 ? COLORS.primary : COLORS.muted,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "center" as const,
      margin: [5, 5, 8, 5] as [number, number, number, number],
    },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: [40, "*", "*", 70],
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= MONTHLY DATA TABLE =============

/**
 * Creates a monthly data table (12 rows)
 */
export function createMonthlyTable(
  data: Array<{
    month: string;
    values: (string | number)[];
  }>,
  headers: string[],
  options: TableStyleOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };
  const widths: (string | number)[] = ["auto", ...headers.slice(1).map(() => "*" as const)];

  const headerRow: TableCell[] = headers.map((header, i) => ({
    text: header,
    fillColor: styles.headerColor,
    color: styles.headerTextColor,
    fontSize: styles.headerFontSize,
    bold: true,
    alignment: (i === 0 ? "left" : "right") as "left" | "right",
    margin: [8, 8, 8, 8] as [number, number, number, number],
  }));

  const bodyRows: TableCell[][] = data.map((row, rowIndex) => {
    const cells: TableCell[] = [
      {
        text: row.month,
        fontSize: styles.fontSize,
        bold: true,
        color: COLORS.secondary,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        margin: [8, 5, 5, 5] as [number, number, number, number],
      },
    ];

    row.values.forEach((value) => {
      cells.push({
        text: String(value),
        fontSize: styles.fontSize,
        color: COLORS.secondary,
        fillColor: rowIndex % 2 === 1 ? styles.alternateRowColor : COLORS.white,
        alignment: "right" as const,
        margin: [5, 5, 8, 5] as [number, number, number, number],
      });
    });

    return cells;
  });

  return {
    table: {
      headerRows: 1,
      widths,
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= TOU SCHEDULE TABLE =============

/**
 * Creates a Time-of-Use schedule table
 */
export function createTOUTable(
  periods: Array<{
    season: string;
    timeOfUse: string;
    rate: string | number;
    demandCharge?: string | number;
  }>,
  options: TableStyleOptions = {}
): ContentTable {
  const styles = { ...defaultTableStyles, ...options };

  const headerRow: TableCell[] = [
    {
      text: "Season",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Period",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Energy Rate",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      alignment: "right" as const,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
    {
      text: "Demand",
      fillColor: styles.headerColor,
      color: styles.headerTextColor,
      fontSize: styles.headerFontSize,
      bold: true,
      alignment: "right" as const,
      margin: [8, 8, 8, 8] as [number, number, number, number],
    },
  ];

  const bodyRows: TableCell[][] = periods.map((period, index) => [
    {
      text: period.season,
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [8, 5, 5, 5] as [number, number, number, number],
    },
    {
      text: period.timeOfUse,
      fontSize: styles.fontSize,
      bold: true,
      color: getTOUColor(period.timeOfUse),
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      margin: [5, 5, 5, 5] as [number, number, number, number],
    },
    {
      text: String(period.rate),
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "right" as const,
      margin: [5, 5, 8, 5] as [number, number, number, number],
    },
    {
      text: period.demandCharge ? String(period.demandCharge) : "-",
      fontSize: styles.fontSize,
      color: COLORS.secondary,
      fillColor: index % 2 === 1 ? styles.alternateRowColor : COLORS.white,
      alignment: "right" as const,
      margin: [5, 5, 8, 5] as [number, number, number, number],
    },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: ["*", "*", "auto", "auto"],
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => styles.borderColor!,
      vLineColor: () => styles.borderColor!,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ============= HELPER FUNCTIONS =============

function getTOUColor(period: string): string {
  const periodLower = period.toLowerCase();
  if (periodLower.includes("peak") && !periodLower.includes("off")) {
    return COLORS.danger;
  }
  if (periodLower.includes("standard")) {
    return COLORS.warning;
  }
  if (periodLower.includes("off-peak") || periodLower.includes("off peak")) {
    return COLORS.primary;
  }
  return COLORS.secondary;
}

// ============= SECTION HEADER =============

/**
 * Creates a styled section header
 */
export function createSectionHeader(
  title: string,
  options: { color?: string; fontSize?: number } = {}
): Content {
  return {
    text: title,
    fontSize: options.fontSize || 14,
    bold: true,
    color: options.color || COLORS.primaryDark,
    margin: [0, 15, 0, 8] as [number, number, number, number],
  };
}
