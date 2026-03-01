/** Shared helper functions for generation tab components */

/** Parse timestamp as local time, stripping any timezone suffix */
export function parseLocal(ts: string): Date {
  const stripped = ts.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(stripped);
}

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export type Timeframe = "30min" | "hourly" | "daily" | "monthly";

export function formatTimeLabel(date: Date, timeframe: Timeframe, month: number, singleDay?: boolean): string {
  if (timeframe === "30min" || timeframe === "hourly") {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    if (singleDay) return `${h}:${m}`;
    const d = date.getDate();
    return `${d} ${h}:${m}`;
  }
  return `${date.getDate()}`;
}

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatNum(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRand(val: number | null | undefined): string {
  if (val == null) return "—";
  return "R " + val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getDayOfWeek(year: number, month: number, day: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(year, month - 1, day).getDay()];
}

export function formatDate(year: number, month: number, day: number): string {
  const dow = getDayOfWeek(year, month, day);
  return `${dow} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
