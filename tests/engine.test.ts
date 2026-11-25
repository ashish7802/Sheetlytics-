import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { validateSpreadsheetFile } from "../lib/excel/validation.ts";
import { parseSpreadsheetBuffer } from "../lib/excel/parser.ts";
import { getSampleWorkbook } from "../lib/excel/samples.ts";
import {
  applyDashboardFilters,
  computeChartData,
  computeSummaryCardValue,
  generateDashboardConfig,
} from "../lib/analytics/engine.ts";

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

test("File validation rejects empty, oversized, and unsupported files", () => {
  assert.equal(validateSpreadsheetFile({ name: "empty.xlsx", size: 0, type: "" }).valid, false);
  assert.equal(validateSpreadsheetFile({ name: "doc.pdf", size: 1024, type: "application/pdf" }).valid, false);
  assert.equal(
    validateSpreadsheetFile({ name: "huge.csv", size: 60 * 1024 * 1024, type: "text/csv" }).valid,
    false
  );
  assert.equal(validateSpreadsheetFile({ name: "valid.xlsx", size: 2048, type: "" }).valid, true);
  assert.equal(validateSpreadsheetFile({ name: "valid.csv", size: 512, type: "text/csv" }).valid, true);
});

test("Sample datasets generate accurate summary cards and charts", () => {
  const prospects = getSampleWorkbook("prospects");
  const sheet = prospects.sheets["Prospects"];
  const config = generateDashboardConfig(sheet, prospects.fileName);

  assert.equal(sheet.rowCount, 24);
  assert.ok(config.summaryCards.length >= 3);
  assert.ok(config.charts.length >= 2);

  const totalCard = config.summaryCards.find((c) => c.aggregation === "count")!;
  assert.equal(computeSummaryCardValue(sheet.rows, totalCard).value, 24);

  const emailCard = config.summaryCards.find((c) => c.aggregation === "non_empty")!;
  assert.equal(computeSummaryCardValue(sheet.rows, emailCard).value, 22);
});

test("Multi-worksheet Excel file with duplicate headers and missing values parses safely", () => {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet([
    ["Student", "Score", "Score", "Status"],
    ["Alice", 92, 88, "Pass"],
    ["Bob", null, 75, "Pass"],
    ["Charlie", 45, 50, "Fail"],
  ]);
  const s2 = XLSX.utils.aoa_to_sheet([
    ["Employee", "Department", "Attendance", "Date"],
    ["Jane", "Engineering", "98%", "2026-01-15"],
    ["Mark", "Sales", "91%", "2026-02-10"],
  ]);
  XLSX.utils.book_append_sheet(wb, s1, "Students");
  XLSX.utils.book_append_sheet(wb, s2, "Attendance");

  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "school.xlsx", bytes.byteLength, "xlsx");

  assert.deepEqual(parsed.sheetNames, ["Students", "Attendance"]);
  assert.equal(parsed.sheets["Students"].rowCount, 3);
  assert.equal(parsed.sheets["Students"].columnCount, 4);
  assert.ok(parsed.warnings.some((w) => w.includes("duplicate column names")));
  assert.equal(parsed.sheets["Students"].columns[1].missingCount, 1);
  assert.equal(parsed.sheets["Attendance"].columns[2].type, "percentage");
  assert.equal(parsed.sheets["Attendance"].columns[3].type, "date");
});

test("Empty spreadsheet throws meaningful error", () => {
  const wb = XLSX.utils.book_new();
  const emptySheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, emptySheet, "Empty");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;

  assert.throws(
    () => parseSpreadsheetBuffer(toArrayBuffer(bytes), "empty.xlsx", bytes.byteLength, "xlsx"),
    /no worksheets with valid headers or data/i
  );
});

test("Filters update summary cards and chart aggregations deterministically", () => {
  const sales = getSampleWorkbook("sales");
  const sheet = sales.sheets["Orders"];
  const config = generateDashboardConfig(sheet, sales.fileName);

  const filtered = applyDashboardFilters(sheet, {
    search: "",
    columnFilters: { Region: ["North America"] },
  });

  assert.ok(filtered.length > 0 && filtered.length < sheet.rowCount);
  const revenueCard = config.summaryCards.find((c) => c.columnKey === "Revenue")!;
  const expectedSum = filtered.reduce((acc, r) => acc + Number(r["Revenue"] ?? 0), 0);
  assert.equal(computeSummaryCardValue(filtered, revenueCard).value, expectedSum);

  const chartData = computeChartData(filtered, config.charts[0], sheet.columns);
  assert.ok(chartData.length > 0);
});

test("Large dataset (5,000 rows) parses and computes analytics quickly", () => {
  const rows: Array<Array<string | number>> = [["ID", "Category", "Amount", "Date"]];
  for (let i = 1; i <= 5000; i++) {
    rows.push([
      `ID-${i}`,
      i % 2 === 0 ? "Enterprise" : "SMB",
      (i % 100) * 10,
      `2026-0${(i % 6) + 1}-15`,
    ]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Large");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;

  const start = Date.now();
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "large.xlsx", bytes.byteLength, "xlsx");
  const config = generateDashboardConfig(parsed.sheets["Large"], "large.xlsx");
  const chartPoints = computeChartData(
    parsed.sheets["Large"].rows,
    config.charts[0],
    parsed.sheets["Large"].columns
  );
  const elapsed = Date.now() - start;

  assert.equal(parsed.sheets["Large"].rowCount, 5000);
  assert.ok(chartPoints.length > 0);
  assert.ok(elapsed < 3000, `Expected < 3000ms, got ${elapsed}ms`);
});
