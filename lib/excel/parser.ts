import * as XLSX from "xlsx";
import { buildColumnKeys, profileColumns } from "./profiler.ts";
import type { CellValue, DataRow, ParsedSheet, ParsedWorkbook } from "../../types/dashboard.ts";

function sanitizeCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return String(value);
}

/**
 * Parses an ArrayBuffer from an .xlsx, .xls, or .csv file into a normalized ParsedWorkbook.
 * Never executes formulas, macros, or embedded HTML.
 */
export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  fileType: "xlsx" | "xls" | "csv"
): ParsedWorkbook {
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      WTF: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parsing error";
    throw new Error(`Unable to read spreadsheet: ${message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded file contains no worksheets.");
  }

  const sheets: Record<string, ParsedSheet> = {};
  const validSheetNames: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Read as 2D array to preserve exact header order, duplicate headers, and blank cells
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });

    if (!rawMatrix || rawMatrix.length === 0) {
      warnings.push(`Worksheet "${sheetName}" is empty.`);
      continue;
    }

    // Find the first non-empty row to use as headers
    const headerRowIndex = rawMatrix.findIndex(
      (row) => Array.isArray(row) && row.some((cell) => cell !== null && String(cell).trim() !== "")
    );

    if (headerRowIndex === -1) {
      warnings.push(`Worksheet "${sheetName}" has no header row.`);
      continue;
    }

    const headerRow = rawMatrix[headerRowIndex] ?? [];
    // Determine max width across header and data rows so no trailing columns are silently dropped
    let maxCols = headerRow.length;
    for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
      const rowLen = Array.isArray(rawMatrix[r]) ? rawMatrix[r].length : 0;
      if (rowLen > maxCols) maxCols = rowLen;
    }

    if (maxCols === 0) {
      warnings.push(`Worksheet "${sheetName}" has no columns.`);
      continue;
    }

    const rawHeaders: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      const cell = headerRow[c];
      rawHeaders.push(cell !== null && cell !== undefined ? String(cell) : "");
    }

    const columnDefs = buildColumnKeys(rawHeaders);
    const duplicateHeaders = columnDefs.filter((c) => c.key !== c.label);
    if (duplicateHeaders.length > 0) {
      warnings.push(
        `Worksheet "${sheetName}" has duplicate column names (${duplicateHeaders
          .map((d) => `"${d.label}"`)
          .join(", ")}). Unique display keys were assigned automatically.`
      );
    }

    const rows: DataRow[] = [];
    for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
      const rawRow = rawMatrix[r];
      if (!Array.isArray(rawRow)) continue;

      const rowObj: DataRow = {};
      let hasAnyValue = false;

      for (let c = 0; c < maxCols; c++) {
        const val = sanitizeCellValue(rawRow[c]);
        if (val !== null) hasAnyValue = true;
        rowObj[columnDefs[c].key] = val;
      }

      if (hasAnyValue) {
        rows.push(rowObj);
      }
    }

    const columns = profileColumns(columnDefs, rows);

    sheets[sheetName] = {
      name: sheetName,
      columns,
      rows,
      rowCount: rows.length,
      columnCount: columns.length,
    };
    validSheetNames.push(sheetName);
  }

  if (validSheetNames.length === 0) {
    throw new Error("The uploaded file has no worksheets with valid headers or data.");
  }

  return {
    fileName,
    fileSize,
    fileType,
    sheetNames: validSheetNames,
    sheets,
    warnings,
  };
}
