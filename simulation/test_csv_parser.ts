import { readFileSync } from "fs";

// MOCK: Robust Date Parser from process-scada-profile/index.ts
function parseDate(dateStr: string, timeStr: string | null): Date | null {
    if (!dateStr) return null;

    const dateTimeStr = timeStr ? `${dateStr} ${timeStr}` : dateStr;
    let date = new Date(dateTimeStr);

    if (!isNaN(date.getTime())) return date;

    // Manual Parsing for common formats that Date() misses
    // DD/MM/YYYY
    const ddmmyyyy = dateTimeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (ddmmyyyy) {
        const [, day, month, year, hour, min, sec] = ddmmyyyy;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
            parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }

    // YYYY/MM/DD
    const yyyymmdd = dateTimeStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (yyyymmdd) {
        const [, year, month, day, hour, min, sec] = yyyymmdd;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
            parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }

    // DD-MMM-YY (01-Jan-24)
    const ddmmmyy = dateTimeStr.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (ddmmmyy) {
        const months: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const [, day, monthStr, year, hour, min, sec] = ddmmmyy;
        const monthValid = months[monthStr.toLowerCase()];
        if (monthValid !== undefined) {
            const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
            return new Date(fullYear, monthValid, parseInt(day),
                parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
        }
    }

    return null;
}

// Test Data
const testCases = [
    { date: "2024-01-01 10:00", time: null, expected: true },
    { date: "01/01/2024 10:00", time: null, expected: true },
    { date: "01/01/2024", time: "10:00", expected: true },
    { date: "01-Jan-24", time: "10:00", expected: true },
    { date: "2024/01/01", time: "10:00:30", expected: true },
    { date: "invalid", time: "10:00", expected: false }
];

console.log("Testing Date Parser Logic:");
testCases.forEach(({ date, time, expected }) => {
    const result = parseDate(date, time);
    const isValid = result && !isNaN(result.getTime());

    if (isValid === expected) {
        console.log(`[PASS] Input: "${date}" ${time ? "+" + time : ""} -> ${result?.toISOString()}`);
    } else {
        console.error(`[FAIL] Input: "${date}" ${time ? "+" + time : ""} -> Got: ${result} (Expected Valid: ${expected})`);
    }
});

