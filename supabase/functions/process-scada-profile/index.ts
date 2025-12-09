import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnAnalysis {
  timestampColumn: string | null;
  dateColumn?: string | null;
  timeColumn?: string | null;
  powerColumn: string | null;
  ignoredColumns: string[];
  confidence: number;
}

interface ProcessedProfile {
  weekdayProfile: number[];
  weekendProfile: number[];
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
}

// Detect delimiter (comma, tab, semicolon)
function detectDelimiter(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

// Parse a line with the detected delimiter
function parseLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, action, timestampColumn, powerColumn, dateColumn, timeColumn } = await req.json();

    if (!csvContent) {
      throw new Error("CSV content is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Detect delimiter
    const delimiter = detectDelimiter(csvContent);
    console.log(`Detected delimiter: ${delimiter === '\t' ? 'TAB' : delimiter}`);

    // Filter out empty lines
    const lines = csvContent.split('\n').filter((l: string) => {
      const trimmed = l.trim();
      return trimmed && !trimmed.toLowerCase().startsWith('sep=');
    });
    
    if (lines.length < 2) {
      throw new Error("CSV must have a header and at least one data row");
    }

    // Detect and skip metadata rows (e.g., "pnpscada.com  34978407")
    let headerLineIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const cols = parseLine(lines[i], delimiter);
      const lowerCols = cols.map((c: string) => c.toLowerCase());
      
      // Check for header keywords
      const hasHeaderKeywords = lowerCols.some((c: string) => 
        c.includes('time') || c === 'date' || c.includes('kwh') || 
        c.includes('kw') || c.includes('power') || c.includes('energy') ||
        c.includes('status') || c.includes('kva') || c.includes('kvar') ||
        /^p\d+$/.test(c) || /^q\d+$/.test(c) // matches p1, q1, etc.
      );
      
      if (cols.length >= 2 && hasHeaderKeywords) {
        headerLineIdx = i;
        break;
      }
    }

    const headers = parseLine(lines[headerLineIdx], delimiter);
    const dataStartIdx = headerLineIdx + 1;
    console.log(`CSV Headers (line ${headerLineIdx + 1}):`, headers);
    console.log(`Data starts at line ${dataStartIdx + 1}, total lines: ${lines.length}`);

    if (action === "analyze") {
      // Sample data rows
      const sampleRows = lines.slice(dataStartIdx, dataStartIdx + 10).map((line: string) => 
        parseLine(line, delimiter)
      );

      // Check if date and time might be in separate columns
      const hasSeparateDateTimeColumns = headers.some(h => 
        h.toLowerCase() === 'time' || h.toLowerCase() === 'date'
      );

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are analyzing a SCADA/meter data file to identify columns for energy consumption analysis.

IMPORTANT: The data may have separate Date and Time columns (e.g., "Time" column with dates like "2025/03/01" and values like "00:30:00").
In PNPSCADA exports, "Time" column often contains DATES (like 2025/03/01) and the next column contains the actual time (like 00:30:00).

Identify:
1. Timestamp handling - either:
   - A single timestampColumn with combined datetime
   - OR separate dateColumn and timeColumn if date and time are in different columns
2. The active power/energy column. Look for:
   - Columns with "kWh" in header or values around 0.1-100 kWh range
   - Columns named "P1", "P2" (these are active power channels)
   - Prefer active power (P, kWh) over reactive (Q, kVArh) or apparent (S, kVA)
3. Columns to ignore (Q columns, S columns, Status, etc.)

Return JSON with:
{
  "timestampColumn": "column name if combined datetime, null if separate",
  "dateColumn": "column name with dates (if separate), null otherwise",
  "timeColumn": "column name with times (if separate), null otherwise",
  "powerColumn": "column name for active power/kWh",
  "ignoredColumns": ["list of ignored columns"],
  "confidence": 0-100,
  "explanation": "Brief explanation"
}`
            },
            {
              role: "user",
              content: `Headers: ${JSON.stringify(headers)}\n\nSample data rows:\n${sampleRows.map((r: string[]) => JSON.stringify(r)).join('\n')}`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "analyze_columns",
              description: "Return the column analysis results",
              parameters: {
                type: "object",
                properties: {
                  timestampColumn: { type: "string", nullable: true },
                  dateColumn: { type: "string", nullable: true },
                  timeColumn: { type: "string", nullable: true },
                  powerColumn: { type: "string", nullable: true },
                  ignoredColumns: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                  explanation: { type: "string" }
                },
                required: ["powerColumn", "ignoredColumns", "confidence", "explanation"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "analyze_columns" } }
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        throw new Error("Failed to analyze CSV columns");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        throw new Error("AI did not return column analysis");
      }

      const analysis = JSON.parse(toolCall.function.arguments);
      console.log("Column analysis:", analysis);

      return new Response(JSON.stringify({
        success: true,
        headers,
        rowCount: lines.length - dataStartIdx,
        delimiter: delimiter === '\t' ? 'tab' : delimiter,
        analysis
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "process") {
      // Determine how to get timestamp
      const usesSeparateDateTime = dateColumn && timeColumn;
      
      let timestampIdx = -1;
      let dateIdx = -1;
      let timeIdx = -1;
      let powerIdx = -1;

      if (usesSeparateDateTime) {
        dateIdx = headers.findIndex(h => h.toLowerCase() === dateColumn.toLowerCase());
        timeIdx = headers.findIndex(h => h.toLowerCase() === timeColumn.toLowerCase());
        if (dateIdx === -1 || timeIdx === -1) {
          throw new Error(`Could not find date/time columns: ${dateColumn}, ${timeColumn}`);
        }
      } else if (timestampColumn) {
        timestampIdx = headers.findIndex(h => h.toLowerCase() === timestampColumn.toLowerCase());
        if (timestampIdx === -1) {
          throw new Error(`Could not find timestamp column: ${timestampColumn}`);
        }
      } else {
        throw new Error("Timestamp or date/time columns are required for processing");
      }

      powerIdx = headers.findIndex(h => h.toLowerCase() === powerColumn.toLowerCase());
      if (powerIdx === -1) {
        throw new Error(`Could not find power column: ${powerColumn}`);
      }

      console.log(`Processing with: timestamp=${timestampIdx}, date=${dateIdx}, time=${timeIdx}, power=${powerIdx}`);

      // Parse all data rows
      const hourlyData: { weekday: number[][]; weekend: number[][] } = {
        weekday: Array.from({ length: 24 }, () => []),
        weekend: Array.from({ length: 24 }, () => []),
      };

      const dates = new Set<string>();
      let weekdayDays = 0;
      let weekendDays = 0;
      const seenDates: Record<string, boolean> = {};
      let parsedCount = 0;
      let skippedCount = 0;

      for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = parseLine(lines[i], delimiter);
        
        let timestampStr: string;
        if (usesSeparateDateTime) {
          const dateStr = cols[dateIdx];
          const timeStr = cols[timeIdx];
          if (!dateStr || !timeStr) {
            skippedCount++;
            continue;
          }
          // Combine date and time - handle various formats
          timestampStr = `${dateStr} ${timeStr}`;
        } else {
          timestampStr = cols[timestampIdx];
        }
        
        const powerStr = cols[powerIdx];

        if (!timestampStr || !powerStr) {
          skippedCount++;
          continue;
        }

        // Parse timestamp - try various formats
        let date: Date | null = null;
        
        // Try ISO format first
        date = new Date(timestampStr);
        
        // If invalid, try common formats
        if (isNaN(date.getTime())) {
          // Try YYYY/MM/DD HH:mm:ss or YYYY-MM-DD HH:mm:ss
          const isoishMatch = timestampStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (isoishMatch) {
            const [, year, month, day, hour, minute, second = '00'] = isoishMatch;
            date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`);
          }
        }
        
        if (isNaN(date?.getTime() || NaN)) {
          // Try DD/MM/YYYY HH:mm or similar
          const ddmmMatch = timestampStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (ddmmMatch) {
            const [, day, month, year, hour, minute, second = '00'] = ddmmMatch;
            const fullYear = year.length === 2 ? `20${year}` : year;
            date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`);
          }
        }

        if (!date || isNaN(date.getTime())) {
          skippedCount++;
          continue;
        }

        const power = parseFloat(powerStr);
        if (isNaN(power)) {
          skippedCount++;
          continue;
        }

        parsedCount++;
        const hour = date.getHours();
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateKey = date.toISOString().split('T')[0];

        dates.add(dateKey);
        
        if (!seenDates[dateKey]) {
          seenDates[dateKey] = true;
          if (isWeekend) weekendDays++;
          else weekdayDays++;
        }

        if (isWeekend) {
          hourlyData.weekend[hour].push(power);
        } else {
          hourlyData.weekday[hour].push(power);
        }
      }

      console.log(`Parsed ${parsedCount} readings, skipped ${skippedCount}`);

      if (parsedCount === 0) {
        throw new Error("No valid data points could be parsed from the file");
      }

      // Calculate averages for each hour
      const weekdayAvg = hourlyData.weekday.map(arr => 
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      );
      const weekendAvg = hourlyData.weekend.map(arr => 
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      );

      // Normalize to percentages summing to 100
      const normalize = (arr: number[]): number[] => {
        const sum = arr.reduce((a, b) => a + b, 0);
        if (sum === 0) return Array(24).fill(100 / 24);
        return arr.map(v => Math.round((v / sum) * 100 * 100) / 100);
      };

      const sortedDates = Array.from(dates).sort();

      const result: ProcessedProfile = {
        weekdayProfile: normalize(weekdayAvg),
        weekendProfile: normalize(weekendAvg),
        dataPoints: parsedCount,
        dateRange: {
          start: sortedDates[0] || '',
          end: sortedDates[sortedDates.length - 1] || ''
        },
        weekdayDays,
        weekendDays
      };

      console.log("Processed profile:", {
        dataPoints: result.dataPoints,
        dateRange: result.dateRange,
        weekdayDays: result.weekdayDays,
        weekendDays: result.weekendDays
      });

      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error("Invalid action. Use 'analyze' or 'process'");
  } catch (error) {
    console.error("process-scada-profile error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
