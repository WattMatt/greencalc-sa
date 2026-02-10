/**
 * Parses one or more CSV files and sums kWh values per month across all files.
 *
 * @param files - FileList from an <input type="file" multiple> element
 * @param valueColumnPattern - regex to identify the kWh/value column header
 * @returns Map<month (1-12), total kWh summed across all files>
 */
export async function parseCSVFiles(
  files: FileList,
  valueColumnPattern: RegExp
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();

  for (let f = 0; f < files.length; f++) {
    const text = await files[f].text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const monthCol = headers.findIndex((h) => /month/i.test(h));
    const valueCol = headers.findIndex((h) => valueColumnPattern.test(h));

    if (monthCol === -1 || valueCol === -1) continue;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const monthVal = parseInt(cols[monthCol]?.trim());
      const kwhVal = parseFloat(cols[valueCol]?.trim());
      if (monthVal >= 1 && monthVal <= 12 && !isNaN(kwhVal)) {
        totals.set(monthVal, (totals.get(monthVal) ?? 0) + kwhVal);
      }
    }
  }

  return totals;
}
