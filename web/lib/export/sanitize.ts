/**
 * Sanitizes values to protect against CSV / Excel formula injection (CSV Injection / CWE-1236).
 * Spreadsheet programs (Excel, LibreOffice, Google Sheets) interpret cells starting with
 * '=', '+', '-', '@', '\t', or '\r' as formulas or executable DDE commands.
 */
const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value);
  if (str.length === 0) return "";

  // Check raw string first (for tabs, cr, etc.)
  const firstChar = str.charAt(0);
  if (DANGEROUS_PREFIXES.includes(firstChar)) {
    return `'${str}`;
  }

  // Also check trimmed string in case user has leading spaces before dangerous prefixes like " =cmd"
  const trimmed = str.trim();
  if (trimmed.length > 0 && DANGEROUS_PREFIXES.includes(trimmed.charAt(0))) {
    return `'${trimmed}`;
  }

  return trimmed;
}

export function escapeCsvCell(value: unknown): string {
  const sanitized = sanitizeSpreadsheetCell(value);

  // If the string contains quotes, commas, or newlines, quote it and escape internal quotes
  if (
    sanitized.includes('"') ||
    sanitized.includes(",") ||
    sanitized.includes("\n") ||
    sanitized.includes("\r")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}
