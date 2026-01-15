/**
 * Fuzzy matching utility for matching CSV filenames to meter names
 */

export interface MatchResult {
  meterId: string;
  meterName: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'partial';
}

/**
 * Normalize a filename or meter name for comparison
 * - Remove common suffixes (.csv, _data, -export, etc.)
 * - Remove special characters and extra whitespace
 * - Convert to lowercase
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  
  let normalized = name
    // Remove file extensions
    .replace(/\.(csv|xlsx?|txt|dat)$/i, '')
    // Remove common suffixes
    .replace(/[_-]?(data|export|meter|reading|profile|import|scada|raw|final|v\d+)$/gi, '')
    // Remove date patterns at the end
    .replace(/[_-]?\d{4}[-_]?\d{2}[-_]?\d{2}$/g, '')
    .replace(/[_-]?\d{2}[-_]\d{2}[-_]\d{4}$/g, '')
    // Remove timestamps
    .replace(/[_-]?\d{2}[-_:]?\d{2}[-_:]?\d{2}$/g, '')
    // Replace underscores and hyphens with spaces
    .replace(/[_-]+/g, ' ')
    // Remove special characters except spaces
    .replace(/[^\w\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Check if one string contains another (partial match)
 */
function getContainmentScore(filename: string, meterName: string): number {
  const f = filename.toLowerCase();
  const m = meterName.toLowerCase();
  
  if (f.includes(m)) {
    // Filename contains meter name
    return Math.min(90, 70 + (m.length / f.length) * 30);
  }
  if (m.includes(f)) {
    // Meter name contains filename
    return Math.min(85, 65 + (f.length / m.length) * 30);
  }
  
  // Check for word overlap
  const fWords = new Set(f.split(/\s+/).filter(w => w.length > 2));
  const mWords = new Set(m.split(/\s+/).filter(w => w.length > 2));
  
  if (fWords.size === 0 || mWords.size === 0) return 0;
  
  let matchingWords = 0;
  for (const word of fWords) {
    if (mWords.has(word)) matchingWords++;
  }
  
  if (matchingWords > 0) {
    const overlapRatio = matchingWords / Math.max(fWords.size, mWords.size);
    return Math.round(overlapRatio * 70);
  }
  
  return 0;
}

export interface MeterInfo {
  id: string;
  shop_name?: string | null;
  meter_label?: string | null;
  site_name?: string;
  shop_number?: string | null;
}

/**
 * Match a filename to the best matching meter
 */
export function matchFilenameToMeter(
  filename: string,
  meters: MeterInfo[]
): MatchResult | null {
  if (!filename || !meters.length) return null;
  
  const normalizedFilename = normalizeName(filename);
  let bestMatch: MatchResult | null = null;
  
  for (const meter of meters) {
    // Try different name fields in priority order
    const candidates = [
      meter.shop_name,
      meter.meter_label,
      meter.shop_number,
      meter.site_name
    ].filter(Boolean) as string[];
    
    for (const candidateName of candidates) {
      const normalizedMeter = normalizeName(candidateName);
      
      // 1. Exact match (after normalization)
      if (normalizedFilename === normalizedMeter) {
        return {
          meterId: meter.id,
          meterName: candidateName,
          confidence: 100,
          matchType: 'exact'
        };
      }
      
      // 2. Check normalized similarity
      const similarity = calculateSimilarity(normalizedFilename, normalizedMeter);
      if (similarity >= 85) {
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = {
            meterId: meter.id,
            meterName: candidateName,
            confidence: similarity,
            matchType: 'normalized'
          };
        }
      }
      
      // 3. Containment check
      const containmentScore = getContainmentScore(normalizedFilename, normalizedMeter);
      if (containmentScore >= 65) {
        if (!bestMatch || containmentScore > bestMatch.confidence) {
          bestMatch = {
            meterId: meter.id,
            meterName: candidateName,
            confidence: containmentScore,
            matchType: 'partial'
          };
        }
      }
      
      // 4. Fuzzy match
      if (!bestMatch || bestMatch.confidence < 60) {
        if (similarity >= 60) {
          if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = {
              meterId: meter.id,
              meterName: candidateName,
              confidence: similarity,
              matchType: 'fuzzy'
            };
          }
        }
      }
    }
  }
  
  return bestMatch;
}

/**
 * Match multiple files to meters, returning best matches
 */
export function matchFilesToMeters(
  files: File[],
  meters: MeterInfo[]
): Map<File, MatchResult | null> {
  const results = new Map<File, MatchResult | null>();
  const usedMeterIds = new Set<string>();
  
  // Sort files by name length (longer names first for better matching)
  const sortedFiles = [...files].sort((a, b) => b.name.length - a.name.length);
  
  for (const file of sortedFiles) {
    // Filter out already matched meters for unique assignment
    const availableMeters = meters.filter(m => !usedMeterIds.has(m.id));
    const match = matchFilenameToMeter(file.name, availableMeters);
    
    if (match && match.confidence >= 50) {
      results.set(file, match);
      usedMeterIds.add(match.meterId);
    } else {
      results.set(file, null);
    }
  }
  
  return results;
}
