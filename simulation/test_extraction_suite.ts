import { parseDate, validateProfile, detectDelimiter, detectUnitFromHeader, calculateDelta } from "../src/components/loadprofiles/utils/sharedParsingUtils";

const MONTH_MAP_REVERSE: Record<number, string> = {
    0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May", 5: "Jun",
    6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct", 10: "Nov", 11: "Dec"
};

const testDates = [
    { date: "2024-01-01", time: "10:00", format: "DMY", expected: "2024-01-01T10:00:00" },
    { date: "01/12/2024", time: "10:00", format: "DMY", expected: "2024-12-01T10:00:00" },
    { date: "01/12/2024", time: "10:00", format: "MDY", expected: "2024-01-12T10:00:00" },
    { date: "31-Jan-24", time: "23:30", format: "DMY", expected: "2024-01-31T23:30:00" },
    { date: "2024.01.01", time: "12:00:30", format: "DMY", expected: "2024-01-01T12:00:30" },
];

console.log("--- Testing Date Parsing ---");
testDates.forEach(({ date, time, format, expected }) => {
    const result = parseDate(date, time, format);
    if (result) {
        // Format expected parts for comparison
        const y = result.getFullYear();
        const m = (result.getMonth() + 1).toString().padStart(2, '0');
        const d = result.getDate().toString().padStart(2, '0');
        const hh = result.getHours().toString().padStart(2, '0');
        const mm = result.getMinutes().toString().padStart(2, '0');
        const ss = result.getSeconds().toString().padStart(2, '0');

        const actualLocal = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
        const passed = actualLocal === expected;
        console.log(`${passed ? "[PASS]" : "[FAIL]"} ${date} ${time || ""} (${format}) -> Got: ${actualLocal} (Expected: ${expected})`);
    } else {
        console.log(`[FAIL] ${date} ${time || ""} (${format}) -> Failed to parse`);
    }
});

console.log("\n--- Testing Profile Validation ---");
const normalProfile = Array(24).fill(10);
const zeroProfile = Array(24).fill(0);
const flatProfile = Array(24).fill(5.5);
const outlierProfile = [100000000, ...Array(23).fill(10)];

const vNormal = validateProfile(normalProfile, normalProfile, 100);
console.log(`Normal Profile (isInvalid: ${vNormal.isInvalid}): ${!vNormal.isInvalid ? "[PASS]" : "[FAIL]"}`);

const vZero = validateProfile(zeroProfile, zeroProfile, 100);
console.log(`Zero Profile (isInvalid: ${vZero.isInvalid}): ${vZero.isInvalid ? "[PASS]" : "[FAIL]"}`);

const vFlat = validateProfile(flatProfile, flatProfile, 100);
console.log(`Flat Profile Warning: ${vFlat.warnings.some(w => w.includes("flat line")) ? "[PASS]" : "[FAIL]"}`);

const vOutlier = validateProfile(outlierProfile, outlierProfile, 100);
console.log(`Outlier Profile (isInvalid: ${vOutlier.isInvalid}): ${vOutlier.isInvalid ? "[PASS]" : "[FAIL]"}`);

console.log("\n--- Testing Delimiter Detection ---");
console.log(`Comma: ${detectDelimiter("a,b,c\n1,2,3") === "," ? "[PASS]" : "[FAIL]"}`);
console.log(`Semicolon: ${detectDelimiter("a;b;c\n1;2;3") === ";" ? "[PASS]" : "[FAIL]"}`);
console.log(`Tab: ${detectDelimiter("a\tb\tc\n1\t2\t3") === "\t" ? "[PASS]" : "[FAIL]"}`);

console.log("\n--- Testing Unit Detection ---");
console.log(`kW: ${detectUnitFromHeader("Active Power (kW)") === "kW" ? "[PASS]" : "[FAIL]"}`);
console.log(`kWh: ${detectUnitFromHeader("Energy (kWh)") === "kWh" ? "[PASS]" : "[FAIL]"}`);
console.log(`Amps: ${detectUnitFromHeader("Current (A)") === "A" ? "[PASS]" : "[FAIL]"}`);
console.log(`MWh: ${detectUnitFromHeader("Total MWh") === "MWh" ? "[PASS]" : "[FAIL]"}`);

console.log("\n--- Testing Delta Calculation ---");
console.log(`Normal Delta: ${calculateDelta(100, 90) === 10 ? "[PASS]" : "[FAIL]"}`);
console.log(`Rollover Delta: ${calculateDelta(5, 9999) === 5 ? "[PASS]" : "[FAIL]"}`);
