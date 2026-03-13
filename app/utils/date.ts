/**
 * Returns the number of whole days since the Unix epoch (local timezone).
 */
export function toDayNumber(year: number, month: number, day: number): number {
  return Math.floor(new Date(year, month - 1, day).getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Formats a Date to "YYYY-MM-DD" using local timezone.
 */
export function isoDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date for an HTML date input: "YYYY-MM-DD".
 */
export function formatDateForInput(d: Date): string {
  return isoDateKey(d);
}
