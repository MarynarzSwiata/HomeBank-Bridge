/**
 * Converts ISO date (YYYY-MM-DD) to comparison-friendly format
 */
export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) return dateStr; // Already ISO
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY to ISO
  }
  return dateStr;
};

/**
 * Converts amount to number, handling edge cases
 */
export const normalizeAmount = (amount: string | number): number => {
  if (typeof amount === 'number') return amount;
  const normalized = amount.replace(/[^0-9,.-]/g, '');
  return parseFloat(normalized.replace(',', '.')) || 0;
};

/**
 * Ensures ID is a number (handles string IDs from forms)
 */
export const normalizeId = (id: string | number | null | undefined): number | null => {
  if (id === null || id === undefined || id === '') return null;
  const num = typeof id === 'number' ? id : parseInt(id, 10);
  return isNaN(num) ? null : num;
};

/**
 * Formats date for display based on user preference
 */
export const formatDate = (
  isoDate: string,
  format: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD' = 'DD-MM-YYYY'
): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;

  switch (format) {
    case 'DD-MM-YYYY':
      return `${d}-${m}-${y}`;
    case 'MM-DD-YYYY':
      return `${m}-${d}-${y}`;
    case 'YYYY-MM-DD':
      return isoDate;
    default:
      return `${d}-${m}-${y}`;
  }
};

/**
 * Safely accesses nested properties
 */
export const safeGet = <T>(obj: any, path: string, defaultValue: T): T => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result?.[key] === undefined) return defaultValue;
    result = result[key];
  }
  return result ?? defaultValue;
};
