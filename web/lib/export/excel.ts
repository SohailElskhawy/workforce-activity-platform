import ExcelJS from "exceljs";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";

export async function generateExcel(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WorkLens";
  workbook.created = new Date();

  // Excel sheet names cannot exceed 31 characters
  const validSheetName = sheetName.slice(0, 31);
  const worksheet = workbook.addWorksheet(validSheetName);

  // Add header row
  worksheet.addRow(headers);
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF0F172A" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 24;

  // Add data rows
  for (const row of rows) {
    const sanitizedRow = row.map((cell) => {
      if (typeof cell === "string") {
        return sanitizeSpreadsheetCell(cell);
      }
      return cell ?? "";
    });
    worksheet.addRow(sanitizedRow);
  }

  // Adjust column widths based on cell content
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellVal = cell.value != null ? String(cell.value) : "";
      maxLength = Math.max(maxLength, cellVal.length + 3);
    });
    column.width = Math.min(maxLength, 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
