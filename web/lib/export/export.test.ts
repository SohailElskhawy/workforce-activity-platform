import assert from "node:assert/strict";
import test from "node:test";

import { escapeCsvCell, sanitizeSpreadsheetCell } from "@/lib/export/sanitize";
import { generateCsv } from "@/lib/export/csv";
import { generateExcel } from "@/lib/export/excel";

test("Spreadsheet formula injection: neutralizes dangerous formula prefixes", () => {
  // Dangerous prefixes: =, +, -, @, \t, \r
  assert.equal(sanitizeSpreadsheetCell("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(
    sanitizeSpreadsheetCell("=cmd|' /C calc'!A0"),
    "'=cmd|' /C calc'!A0",
  );
  assert.equal(sanitizeSpreadsheetCell("+123456789"), "'+123456789");
  assert.equal(sanitizeSpreadsheetCell("-100"), "'-100");
  assert.equal(sanitizeSpreadsheetCell("@username"), "'@username");
  assert.equal(sanitizeSpreadsheetCell("\tTabIndented"), "'\tTabIndented");

  // Safe strings and non-strings remain unchanged
  assert.equal(sanitizeSpreadsheetCell("Normal project code"), "Normal project code");
  assert.equal(sanitizeSpreadsheetCell("AutoCAD 2026.dwg"), "AutoCAD 2026.dwg");
  assert.equal(sanitizeSpreadsheetCell(42), "42");
  assert.equal(sanitizeSpreadsheetCell(null), "");
  assert.equal(sanitizeSpreadsheetCell(undefined), "");
});

test("CSV cell escaping: properly escapes quotes, commas, and newlines", () => {
  assert.equal(escapeCsvCell("Simple text"), "Simple text");
  assert.equal(escapeCsvCell('Text with "quotes"'), '"Text with ""quotes"""');
  assert.equal(escapeCsvCell("Column A, Column B"), '"Column A, Column B"');
  assert.equal(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.equal(
    escapeCsvCell('=DDE("cmd";"/C calc";"A0")'),
    "\"'=DDE(\"\"cmd\"\";\"\"/C calc\"\";\"\"A0\"\")\"",
  );
  assert.equal(escapeCsvCell("=SUM(A1, B1)"), "\"'=SUM(A1, B1)\"");
});

test("CSV generation: prepends UTF-8 BOM and formats CRLF rows", () => {
  const headers = ["Çalışan", "Proje", "Süre (dk)"];
  const rows = [
    ["Ali Yılmaz", "PRJ-001", 120],
    ["Ayşe Demir", "PRJ-002", 90],
  ];

  const csv = generateCsv(headers, rows);

  // Must start with UTF-8 BOM
  assert.equal(csv.startsWith("\uFEFF"), true);
  // Must preserve Turkish characters
  assert.equal(csv.includes("Çalışan"), true);
  assert.equal(csv.includes("Ali Yılmaz"), true);
  assert.equal(csv.includes("Ayşe Demir"), true);
  // Must use CRLF line breaks
  assert.equal(csv.includes("\r\n"), true);
});

test("Excel generation: creates valid XLSX buffer with styled sheet", async () => {
  const headers = ["Employee", "Project", "Minutes"];
  const rows = [
    ["John Doe", "PRJ-Alpha", 150],
    ["Jane Smith", "PRJ-Beta", 200],
  ];

  const buffer = await generateExcel("Employees", headers, rows);

  assert.equal(Buffer.isBuffer(buffer), true);
  assert.equal(buffer.length > 100, true);

  // Check standard PK zip header signature for .xlsx files (0x50, 0x4B, 0x03, 0x04)
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
  assert.equal(buffer[2], 0x03);
  assert.equal(buffer[3], 0x04);
});
