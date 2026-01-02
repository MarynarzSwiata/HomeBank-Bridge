/**
 * Utility functions for file export and download.
 */

/**
 * Sanitize a string for CSV format to prevent injection attacks.
 * Escapes semicolons and newlines.
 */
export const sanitizeCSVField = (str: string): string => {
  if (typeof str !== 'string') return '';
  // Basic sanitization: replace semicolons and line breaks
  // Also avoid starting with = + - @ which can be interpreted as formulas in Excel
  let sanitized = str.replace(/;/g, ',').replace(/[\r\n]+/g, ' ').trim();
  if (/^[=+\-@]/.test(sanitized)) {
      sanitized = "'" + sanitized;
  }
  return sanitized;
};

/**
 * Trigger a browser download for a given content string.
 */
export const triggerDownload = (content: string, name: string, type: string = "text/csv;charset=utf-8;"): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", name);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  requestAnimationFrame(() => URL.revokeObjectURL(url));
};

/**
 * Helper to get ISO date string YYYY-MM-DD
 */
export const getExportDateString = (): string => {
    return new Date().toISOString().slice(0, 10);
};
