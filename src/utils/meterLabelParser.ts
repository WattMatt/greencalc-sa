/**
 * Parses meter labels to extract shop name, shop number, and area.
 *
 * Supported patterns:
 *   PDB_36506603_HomeEssentials_3365m2
 *   PDB_35775424_Dischem_1462m2
 *   PDB_36085238_Sorbet_87m2
 *   Woolworths
 *   ABC FINANCE
 */

export interface ParsedMeterLabel {
  shopName: string;
  shopNumber: string | null;
  areaSqm: number;
  prefix: string | null;
}

/**
 * Insert a space before each uppercase letter that follows a lowercase letter,
 * or before a sequence of uppercase letters followed by a lowercase (e.g. "DT" in "BurgerKingDT").
 */
function expandCamelCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

export function parseMeterLabel(
  label: string | null | undefined,
  fallbackSiteName?: string
): ParsedMeterLabel {
  const raw = (label ?? fallbackSiteName ?? "").trim();

  if (!raw) {
    return { shopName: "Unknown", shopNumber: null, areaSqm: 0, prefix: null };
  }

  const parts = raw.split("_");

  // Detect PDB pattern: PDB_<number>_<Name>_<area>m2
  if (
    parts.length >= 3 &&
    parts[0].toUpperCase() === "PDB" &&
    /^\d+$/.test(parts[1])
  ) {
    const shopNumber = parts[1];

    // Find area segment (ends with m2, case-insensitive)
    let areaSqm = 0;
    const nameParts: string[] = [];

    for (let i = 2; i < parts.length; i++) {
      const areaMatch = parts[i].match(/^(\d+(?:\.\d+)?)\s*m2$/i);
      if (areaMatch) {
        areaSqm = parseFloat(areaMatch[1]);
      } else {
        nameParts.push(parts[i]);
      }
    }

    const shopName = nameParts.map(expandCamelCase).join(" ") || "Unknown";

    return { shopName, shopNumber, areaSqm, prefix: parts[0].toUpperCase() };
  }

  // Non-PDB: try to find area anywhere (e.g. "SomeName_500m2")
  if (parts.length > 1) {
    let areaSqm = 0;
    const nameParts: string[] = [];

    for (const part of parts) {
      const areaMatch = part.match(/^(\d+(?:\.\d+)?)\s*m2$/i);
      if (areaMatch) {
        areaSqm = parseFloat(areaMatch[1]);
      } else {
        nameParts.push(part);
      }
    }

    const shopName = nameParts.map(expandCamelCase).join(" ") || raw;
    return { shopName, shopNumber: null, areaSqm };
  }

  // Plain string — use as-is
  return { shopName: expandCamelCase(raw), shopNumber: null, areaSqm: 0 };
}
