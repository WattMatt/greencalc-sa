// CSV Type Detection Utility
// Detects the type of CSV data and suggests the correct import location

export type CsvDataType = 
  | "scada-meter" 
  | "tenant-list" 
  | "shop-types" 
  | "unknown";

export interface CsvTypeDetectionResult {
  detectedType: CsvDataType;
  confidence: "high" | "medium" | "low";
  matchedPatterns: string[];
  suggestedLocation: string;
  expectedColumns: string;
}

// Common patterns for each CSV type
const SCADA_PATTERNS = [
  "rdate", "rtime", "kwh+", "kwh-", "kvarh", "kva", "pf", "status",
  "active energy", "reactive energy", "power factor", "meter reading"
];

const TENANT_PATTERNS = [
  "name", "tenant", "shop", "store", "unit",
  "area", "sqm", "size", "m2", "m²", "square"
];

const SHOP_TYPE_PATTERNS = [
  "name", "type", "category",
  "kwh", "consumption", "h0", "h1", "h2", "h3"
];

export function detectCsvType(headers: string[]): CsvTypeDetectionResult {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Count matches for each type
  const scadaMatches = SCADA_PATTERNS.filter(p => 
    lowerHeaders.some(h => h.includes(p))
  );
  const tenantMatches = TENANT_PATTERNS.filter(p => 
    lowerHeaders.some(h => h.includes(p))
  );
  const shopTypeMatches = SHOP_TYPE_PATTERNS.filter(p => 
    lowerHeaders.some(h => h.includes(p))
  );

  // SCADA detection - look for time-series data columns
  const hasDateTimeColumns = lowerHeaders.some(h => 
    h.includes("date") || h.includes("time") || h === "rdate" || h === "rtime"
  );
  const hasEnergyColumns = lowerHeaders.some(h => 
    h.includes("kwh") || h.includes("kva") || h.includes("kvarh") || h.includes("energy")
  );
  
  if (hasDateTimeColumns && hasEnergyColumns && scadaMatches.length >= 2) {
    return {
      detectedType: "scada-meter",
      confidence: scadaMatches.length >= 4 ? "high" : "medium",
      matchedPatterns: scadaMatches,
      suggestedLocation: "Load Profiles → SCADA Import",
      expectedColumns: "rdate, rtime, kWh+, kvarh+, kWh-, kvarh-, kVA, pf, Status"
    };
  }

  // Tenant detection - look for name + area columns
  const hasNameColumn = lowerHeaders.some(h => 
    h.includes("name") || h.includes("tenant") || h.includes("shop") || h.includes("store")
  );
  const hasAreaColumn = lowerHeaders.some(h => 
    h.includes("area") || h.includes("sqm") || h.includes("m2") || h.includes("size")
  );
  
  if (hasNameColumn && hasAreaColumn) {
    return {
      detectedType: "tenant-list",
      confidence: tenantMatches.length >= 3 ? "high" : "medium",
      matchedPatterns: tenantMatches,
      suggestedLocation: "Project → Tenants tab",
      expectedColumns: "name, area (sqm)"
    };
  }

  // Shop types detection - look for name + kwh columns
  const hasKwhColumn = lowerHeaders.some(h => 
    h.includes("kwh") || h.includes("consumption")
  );
  const hasHourlyColumns = lowerHeaders.some(h => 
    /^h\d+$/.test(h) || h.includes("hour")
  );
  
  if (hasNameColumn && (hasKwhColumn || hasHourlyColumns)) {
    return {
      detectedType: "shop-types",
      confidence: shopTypeMatches.length >= 3 ? "high" : "medium",
      matchedPatterns: shopTypeMatches,
      suggestedLocation: "Project → Shop Types tab",
      expectedColumns: "name, kwh_per_sqm_month, description (optional), h0-h23 (optional)"
    };
  }

  return {
    detectedType: "unknown",
    confidence: "low",
    matchedPatterns: [],
    suggestedLocation: "Unknown",
    expectedColumns: "Could not determine expected format"
  };
}

export function buildMismatchErrorMessage(
  expectedType: CsvDataType,
  detection: CsvTypeDetectionResult,
  foundHeaders: string[]
): string {
  const typeLabels: Record<CsvDataType, string> = {
    "scada-meter": "SCADA/Meter Data",
    "tenant-list": "Tenant List",
    "shop-types": "Shop Types",
    "unknown": "Unknown Data"
  };

  const expectedLabel = typeLabels[expectedType];
  const detectedLabel = typeLabels[detection.detectedType];

  if (detection.detectedType === expectedType) {
    return ""; // No mismatch
  }

  let message = `This file appears to contain ${detectedLabel}`;
  
  if (detection.confidence === "high") {
    message += ` (detected columns: ${detection.matchedPatterns.slice(0, 5).join(", ")}).`;
  } else {
    message += ".";
  }

  if (detection.detectedType !== "unknown") {
    message += `\n\n📍 To import this data, go to: ${detection.suggestedLocation}`;
  }

  message += `\n\n📋 This import expects ${expectedLabel} with columns like: ${getExpectedColumnsForType(expectedType)}`;
  message += `\n\n🔍 Found columns: ${foundHeaders.join(", ")}`;

  return message;
}

function getExpectedColumnsForType(type: CsvDataType): string {
  switch (type) {
    case "scada-meter":
      return "rdate, rtime, kWh+, kvarh+, kVA, pf, Status";
    case "tenant-list":
      return "name (or tenant/shop), area (or sqm/size/m2)";
    case "shop-types":
      return "name, kwh_per_sqm_month, h0-h23 (optional hourly profile)";
    default:
      return "Unknown";
  }
}
