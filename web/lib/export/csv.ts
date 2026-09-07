import { escapeCsvCell } from "@/lib/export/sanitize";

export function generateCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  // UTF-8 BOM for Microsoft Excel on Windows to correctly detect UTF-8 encoding (especially for Turkish characters)
  const UTF8_BOM = "\uFEFF";

  const headerLine = headers.map(escapeCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(","));

  return UTF8_BOM + [headerLine, ...rowLines].join("\r\n");
}
