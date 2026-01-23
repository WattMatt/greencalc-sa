import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a decimal year value to a "X years Y months" string
 * @param decimalYears - Payback period in decimal years (e.g., 3.15)
 * @returns Formatted string like "3 years 2 months" or "3 years" if no months
 */
export function formatPaybackPeriod(decimalYears: number): string {
  if (decimalYears <= 0) return "-";
  if (decimalYears > 25) return ">25 years";
  
  const years = Math.floor(decimalYears);
  const monthsFraction = decimalYears - years;
  const months = Math.round(monthsFraction * 12);
  
  // Handle edge case where months round to 12
  if (months === 12) {
    return `${years + 1} year${years + 1 === 1 ? '' : 's'}`;
  }
  
  const yearStr = years > 0 ? `${years} year${years === 1 ? '' : 's'}` : '';
  const monthStr = months > 0 ? `${months} month${months === 1 ? '' : 's'}` : '';
  
  if (years > 0 && months > 0) {
    return `${yearStr} ${monthStr}`;
  }
  return yearStr || monthStr || '-';
}
