/**
 * Centralized date utilities for the HomeBank Bridge application.
 */

/**
 * Parses a date string for filtering comparisons.
 * Handles both "YYYY-MM-DD" and "DD-MM-YYYY" formats.
 */
export const parseDateForComparison = (dateStr: string): string => {
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    // If it's already YYYY-MM-DD
    if (parts[0].length === 4) return dateStr;
    // If it's DD-MM-YYYY, convert to YYYY-MM-DD
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr || '';
};

/**
 * Formats an ISO date string (YYYY-MM-DD) for display based on user preference.
 */
export const formatDateForDisplay = (isoDate: string, format: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  switch (format) {
    case 'DD-MM-YYYY':
      return `${d}-${m}-${y}`;
    case 'MM-DD-YYYY':
      return `${m}-${d}-${y}`;
    default:
      return isoDate;
  }
};

/**
 * Returns today's date in ISO format (YYYY-MM-DD).
 */
export const getTodayISO = (): string => new Date().toISOString().split('T')[0];

/**
 * Formats an ISO date string for CSV export (DD-MM-YYYY).
 */
export const formatDateForExport = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
};
