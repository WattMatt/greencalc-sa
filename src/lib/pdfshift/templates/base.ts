// Base HTML template with styling for PDFShift PDF generation

export const COLORS = {
  primary: "#22c55e",
  primaryDark: "#16a34a",
  secondary: "#0f172a",
  accent: "#3b82f6",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#64748b",
  background: "#f8fafc",
  white: "#ffffff",
  black: "#000000",
};

export const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: ${COLORS.secondary};
    background: ${COLORS.white};
  }
  
  .page {
    page-break-after: always;
    padding: 15mm;
    min-height: 297mm;
    position: relative;
  }
  
  .page:last-child {
    page-break-after: avoid;
  }
  
  h1 {
    font-size: 24pt;
    font-weight: 700;
    color: ${COLORS.secondary};
    margin-bottom: 8px;
  }
  
  h2 {
    font-size: 16pt;
    font-weight: 600;
    color: ${COLORS.secondary};
    margin-bottom: 12px;
  }
  
  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: ${COLORS.primaryDark};
    margin-bottom: 8px;
  }
  
  p {
    margin-bottom: 10px;
    line-height: 1.6;
  }
  
  .text-muted {
    color: ${COLORS.muted};
  }
  
  .text-primary {
    color: ${COLORS.primary};
  }
  
  .text-white {
    color: ${COLORS.white};
  }
  
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  
  .text-sm { font-size: 9pt; }
  .text-xs { font-size: 8pt; }
  .text-lg { font-size: 14pt; }
  .text-xl { font-size: 18pt; }
  .text-2xl { font-size: 24pt; }
  .text-3xl { font-size: 32pt; }
  
  /* Header band */
  .header-band {
    background: ${COLORS.secondary};
    color: ${COLORS.white};
    padding: 20px;
    margin: -15mm -15mm 20px -15mm;
  }
  
  .header-band-accent {
    background: ${COLORS.primary};
    height: 4px;
    margin: 0 -15mm 20px -15mm;
  }
  
  /* Section header */
  .section-header {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    padding: 8px 15px;
    margin: 0 -15mm 15px -15mm;
    font-weight: 600;
    font-size: 12pt;
  }
  
  /* Grid system */
  .grid {
    display: grid;
    gap: 15px;
  }
  
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  
  .flex {
    display: flex;
  }
  
  .flex-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .gap-2 { gap: 8px; }
  .gap-4 { gap: 15px; }
  
  /* Metric cards */
  .metric-card {
    text-align: center;
    padding: 15px;
    border-radius: 6px;
    background: ${COLORS.background};
  }
  
  .metric-card.primary {
    background: ${COLORS.primary};
    color: ${COLORS.white};
  }
  
  .metric-card.accent {
    background: ${COLORS.accent};
    color: ${COLORS.white};
  }
  
  .metric-card.warning {
    background: ${COLORS.warning};
    color: ${COLORS.white};
  }
  
  .metric-value {
    font-size: 24pt;
    font-weight: 700;
    line-height: 1.2;
  }
  
  .metric-unit {
    font-size: 10pt;
    opacity: 0.8;
  }
  
  .metric-label {
    font-size: 8pt;
    opacity: 0.9;
    margin-top: 5px;
  }
  
  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 9pt;
  }
  
  th {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    font-weight: 600;
    text-align: left;
    padding: 8px 10px;
  }
  
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #eee;
  }
  
  tr:nth-child(even) td {
    background: #fafafa;
  }
  
  .table-striped tr:nth-child(even) td {
    background: ${COLORS.background};
  }
  
  /* Narrative box */
  .narrative-box {
    background: #dcfce7;
    border-left: 3px solid ${COLORS.primary};
    padding: 12px 15px;
    margin: 10px 0 15px 0;
    font-size: 9pt;
    line-height: 1.5;
  }
  
  .narrative-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .narrative-title {
    font-weight: 600;
    color: ${COLORS.primaryDark};
  }
  
  .ai-badge {
    background: ${COLORS.primaryDark};
    color: ${COLORS.white};
    font-size: 6pt;
    padding: 2px 6px;
    border-radius: 3px;
  }
  
  /* TOU Period cards */
  .tou-card {
    padding: 12px;
    border-radius: 6px;
    text-align: center;
    color: ${COLORS.white};
  }
  
  .tou-peak { background: ${COLORS.danger}; }
  .tou-standard { background: ${COLORS.warning}; }
  .tou-offpeak { background: ${COLORS.primary}; }
  
  /* Footer */
  .page-footer {
    position: absolute;
    bottom: 10mm;
    left: 15mm;
    right: 15mm;
    font-size: 7pt;
    color: ${COLORS.muted};
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #eee;
    padding-top: 8px;
  }
  
  /* Draft watermark */
  .draft-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 80pt;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.05);
    pointer-events: none;
    z-index: 0;
  }
  
  /* Signature line */
  .signature-line {
    border-top: 1px solid #ccc;
    width: 150px;
    margin-top: 30px;
    padding-top: 5px;
  }
  
  /* Month calendar */
  .month-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 0;
  }
  
  .month-cell {
    padding: 8px 4px;
    text-align: center;
    font-weight: 600;
    color: ${COLORS.white};
  }
  
  .month-high { background: ${COLORS.danger}; }
  .month-low { background: ${COLORS.primary}; }
`;

export function wrapInDocument(content: string, title: string = 'Report'): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
${content}
</body>
</html>
  `.trim();
}

export function formatCurrency(value: number, abbreviate = false): string {
  if (abbreviate) {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
  }
  return `R${value.toLocaleString()}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
