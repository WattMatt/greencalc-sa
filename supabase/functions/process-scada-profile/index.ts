import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnAnalysis {
  timestampColumn: string | null;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, action } = await req.json();

    if (!csvContent) {
      throw new Error("CSV content is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lines = csvContent.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      throw new Error("CSV must have a header and at least one data row");
    }

    // Detect and skip metadata rows (e.g., "pnpscada.com,33883284")
    // Header row should have multiple columns and look like column names
    let headerLineIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const cols = lines[i].split(',').map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
      // Check if this looks like a header row:
      // - Has multiple columns (>2)
      // - Contains typical header keywords OR doesn't look like pure data
      const lowerCols = cols.map((c: string) => c.toLowerCase());
      const hasHeaderKeywords = lowerCols.some((c: string) => 
        c.includes('time') || c.includes('date') || c.includes('kwh') || 
        c.includes('kw') || c.includes('power') || c.includes('energy') ||
        c.includes('status') || c.includes('kva') || c.includes('kvar')
      );
      
      if (cols.length > 2 && hasHeaderKeywords) {
        headerLineIdx = i;
        break;
      }
    }

    const headers = lines[headerLineIdx].split(',').map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
    const dataStartIdx = headerLineIdx + 1;
    console.log(`CSV Headers (line ${headerLineIdx + 1}):`, headers);
    console.log(`Data starts at line ${dataStartIdx + 1}`);

    if (action === "analyze") {
      // Use AI to analyze columns - sample from data rows (after header)
      const sampleRows = lines.slice(dataStartIdx, dataStartIdx + 5).map((line: string) => 
        line.split(',').map((c: string) => c.trim().replace(/^["']|["']$/g, ''))
      ) as string[][];

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
              content: `You are analyzing a SCADA/meter data CSV to identify columns for energy consumption analysis.
Identify:
1. The timestamp/datetime column (look for: Time, Date, Timestamp, DateTime, or columns with date patterns)
2. The active power/energy consumption column (look for: kWh, P1, Active Power, Energy, Wh - prefer kWh over kVArh/reactive)
3. Which columns should be ignored (reactive power kVArh, apparent power kVA, status codes, etc.)

Return a JSON object with:
{
  "timestampColumn": "column name or null",
  "powerColumn": "column name or null", 
  "ignoredColumns": ["list", "of", "ignored", "columns"],
  "confidence": 0-100,
  "explanation": "Brief explanation of your analysis"
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
                  powerColumn: { type: "string", nullable: true },
                  ignoredColumns: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                  explanation: { type: "string" }
                },
                required: ["timestampColumn", "powerColumn", "ignoredColumns", "confidence", "explanation"]
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
        analysis
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "process") {
      const { timestampColumn, powerColumn } = await req.json();

      if (!timestampColumn || !powerColumn) {
        throw new Error("Timestamp and power columns are required for processing");
      }

      const timestampIdx = headers.indexOf(timestampColumn);
      const powerIdx = headers.indexOf(powerColumn);

      if (timestampIdx === -1 || powerIdx === -1) {
        throw new Error("Could not find specified columns in CSV");
      }

      // Parse all data rows
      const hourlyData: { weekday: number[][]; weekend: number[][] } = {
        weekday: Array.from({ length: 24 }, () => []),
        weekend: Array.from({ length: 24 }, () => []),
      };

      const dates = new Set<string>();
      let weekdayDays = 0;
      let weekendDays = 0;
      const seenDates: Record<string, boolean> = {};

      for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
        const timestampStr = cols[timestampIdx];
        const powerStr = cols[powerIdx];

        if (!timestampStr || !powerStr) continue;

        // Parse timestamp - try various formats
        let date: Date | null = null;
        
        // Try ISO format first
        date = new Date(timestampStr);
        
        // If invalid, try common formats
        if (isNaN(date.getTime())) {
          // Try DD/MM/YYYY HH:mm or similar
          const parts = timestampStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (parts) {
            const [, day, month, year, hour, minute] = parts;
            const fullYear = year.length === 2 ? `20${year}` : year;
            date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`);
          }
        }

        if (!date || isNaN(date.getTime())) continue;

        const power = parseFloat(powerStr);
        if (isNaN(power)) continue;

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
        dataPoints: lines.length - dataStartIdx,
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