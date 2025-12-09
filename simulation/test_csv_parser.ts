import { readFileSync } from "fs";

// Mocking the logic from process-scada-profile/index.ts

function parseDate(timestampStr: string): Date | null {
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

    if (isNaN(date?.getTime() || NaN)) {
        // Try DD-MMM-YY HH:mm (e.g. 01-Jan-24 00:00)
        const ddMmmyyMatch = timestampStr.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (ddMmmyyMatch) {
            const months: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            const [, day, monthStr, year, hour, minute, second = '00'] = ddMmmyyMatch;
            const month = months[monthStr.toLowerCase()];
            if (month) {
                const fullYear = year.length === 2 ? `20${year}` : year;
                date = new Date(`${fullYear}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`);
            }
        }
    }

    return date;
}

const csvContent = readFileSync("simulation/data/meter_data.csv", "utf-8");
const lines = csvContent.split('\n').filter(l => l.trim());

console.log("Testing Date Parsing:");
// Skip header
for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const timestampStr = cols[0];
    const power = cols[1];

    const date = parseDate(timestampStr);

    if (date && !isNaN(date.getTime())) {
        console.log(`[PASS] Input: "${timestampStr}" -> Parsed: ${date.toISOString()} | Power: ${power}`);
    } else {
        console.error(`[FAIL] Input: "${timestampStr}" -> Could not parse`);
    }
}
