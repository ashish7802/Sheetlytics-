import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { validateSpreadsheetFile } from "../lib/excel/validation.ts";
import { parseSpreadsheetBuffer } from "../lib/excel/parser.ts";
import { parseDateDeterministic, tryParseDateIso } from "../lib/excel/profiler.ts";
import { getSampleWorkbook } from "../lib/excel/samples.ts";
import { formatCurrency } from "../lib/utils.ts";
import {
  applyDashboardFilters,
  computeSummaryCardValue,
  ensureTableSection,
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
  assert.equal(validateSpreadsheetFile({ name: "valid.xls", size: 2048, type: "" }).valid, true);
  assert.equal(validateSpreadsheetFile({ name: "valid.csv", size: 512, type: "text/csv" }).valid, true);
});

test("CSV spreadsheet parses accurately and preserves rows", () => {
  const csv = "Name,Department,Salary\nAlice,Engineering,₹95000\nBob,Sales,₹72000\n";
  const bytes = new TextEncoder().encode(csv);
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "team.csv", bytes.byteLength, "csv");
  const sheet = parsed.sheets[parsed.sheetNames[0]];

  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.columnCount, 3);
  assert.equal(sheet.columns[2].type, "currency");
  assert.equal(sheet.columns[2].currencyCode, "INR");
  assert.equal(formatCurrency(95000, false, "INR"), "₹95,000");
});

test("Dashboard config is strictly chart-free and generates accurate summary cards", () => {
  const prospects = getSampleWorkbook("prospects");
  const sheet = prospects.sheets["Prospects"];
  const config = generateDashboardConfig(sheet, prospects.fileName);

  assert.equal(sheet.rowCount, 24);
  assert.deepEqual(config.sectionOrder, ["summary", "table"]);
  assert.equal("charts" in config, false);

  const totalCard = config.summaryCards.find((c) => c.aggregation === "count")!;
  assert.equal(computeSummaryCardValue(sheet.rows, totalCard).value, 24);

  const emailCard = config.summaryCards.find((c) => c.aggregation === "non_empty")!;
  assert.ok(!emailCard.title.toLowerCase().includes("verified"));
  assert.equal(computeSummaryCardValue(sheet.rows, emailCard).value, 22);
});

test("Summary card average divides by valid numeric count, NOT total row count", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Category", "Score"],
    ["Alpha", 10],
    ["Alpha", 20],
    ["Alpha", null],
    ["Alpha", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Scores");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "scores.xlsx", bytes.byteLength, "xlsx");
  const sheet = parsed.sheets["Scores"];

  const avgResult = computeSummaryCardValue(sheet.rows, {
    id: "avg-score",
    title: "Avg Score",
    columnKey: "Score",
    aggregation: "avg",
    format: "number",
    accent: "indigo",
  });

  assert.equal(avgResult.validCount, 2);
  assert.equal(avgResult.missingCount, 2);
  assert.equal(avgResult.value, 15);
});

test("Text-only, one-column datasets always preserve mandatory table and strip charts", () => {
  const textWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    textWb,
    XLSX.utils.aoa_to_sheet([
      ["Title", "Notes"],
      ["Alpha Note", "First description"],
      ["Beta Note", "Second description"],
    ]),
    "Notes"
  );
  const textBytes = XLSX.write(textWb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const textParsed = parseSpreadsheetBuffer(toArrayBuffer(textBytes), "notes.xlsx", textBytes.byteLength, "xlsx");
  const textCfg = generateDashboardConfig(textParsed.sheets["Notes"], "notes.xlsx");
  assert.ok(textCfg.sectionOrder.includes("table"));
  assert.equal(textParsed.sheets["Notes"].rowCount, 2);

  const oneColWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    oneColWb,
    XLSX.utils.aoa_to_sheet([["Item"], ["One"], ["Two"], ["Three"]]),
    "Single"
  );
  const oneBytes = XLSX.write(oneColWb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const oneParsed = parseSpreadsheetBuffer(toArrayBuffer(oneBytes), "one.xlsx", oneBytes.byteLength, "xlsx");
  const oneCfg = generateDashboardConfig(oneParsed.sheets["Single"], "one.xlsx");
  assert.ok(oneCfg.sectionOrder.includes("table"));
  assert.equal(oneParsed.sheets["Single"].columnCount, 1);
  assert.equal(oneParsed.sheets["Single"].rowCount, 3);

  const sanitized = ensureTableSection(["summary", "charts"]);
  assert.deepEqual(sanitized, ["summary", "table"]);
});

test("Deterministic date parsing handles ISO, Excel serials, and MDY/DMY ambiguity", () => {
  assert.equal(tryParseDateIso("2026-03-15"), "2026-03-15");
  assert.equal(tryParseDateIso("15/03/2026"), "2026-03-15");
  assert.equal(tryParseDateIso("03/15/2026"), "2026-03-15");
  assert.equal(tryParseDateIso(46023, "auto", true), "2026-01-01");
  assert.equal(tryParseDateIso("invalid-date"), null);

  const ambigMdy = parseDateDeterministic("01/02/2026", "MDY");
  assert.equal(ambigMdy?.iso, "2026-01-02");
  assert.equal(ambigMdy?.ambiguous, true);

  const ambigDmy = parseDateDeterministic("01/02/2026", "DMY");
  assert.equal(ambigDmy?.iso, "2026-02-01");
  assert.equal(ambigDmy?.ambiguous, true);
});

test("Category filters expose all >12 categories and support blank-value and table column filters", () => {
  const rows: Array<Array<string | number | null>> = [["Category", "Amount"]];
  for (let i = 1; i <= 20; i++) {
    rows.push([`Cat-${String(i).padStart(2, "0")}`, i * 100]);
  }
  rows.push([null, 50]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Data");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "cats.xlsx", bytes.byteLength, "xlsx");
  const sheet = parsed.sheets["Data"];

  assert.equal(sheet.columns[0].uniqueValues.length, 20);
  assert.ok(sheet.columns[0].uniqueValues.includes("Cat-20"));

  const blankOnly = applyDashboardFilters(sheet, {
    search: "",
    columnFilters: { Category: ["(Blank)"] },
  });
  assert.equal(blankOnly.length, 1);
  assert.equal(blankOnly[0]["Amount"], 50);

  const rangeFiltered = applyDashboardFilters(sheet, {
    search: "",
    columnFilters: {},
    tableColumnFilters: {
      Amount: { mode: "range", min: "1800", max: "2000" },
    },
  });
  assert.equal(rangeFiltered.length, 3);
});

test("Multi-worksheet Excel file with duplicate headers, blank headers, and empty sheets parses safely", () => {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet([
    ["Student", "Score", "Score", "", "Status"],
    ["Alice", 92, 88, "Note A", "Pass"],
    ["Bob", null, 75, "Note B", "Pass"],
  ]);
  const sEmpty = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, s1, "Students");
  XLSX.utils.book_append_sheet(wb, sEmpty, "BlankSheet");

  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), "school.xlsx", bytes.byteLength, "xlsx");

  assert.deepEqual(parsed.sheetNames, ["Students"]);
  assert.equal(parsed.sheets["Students"].columnCount, 5);
  assert.equal(parsed.sheets["Students"].columns[3].label, "Column 4");
  assert.ok(parsed.warnings.some((w) => w.includes("BlankSheet")));
  assert.ok(parsed.warnings.some((w) => w.includes("duplicate column names")));
});

test("Large datasets (5k, 10k, 50k rows) parse and compute summary cards within budget", () => {
  for (const size of [5000, 10000, 50000]) {
    const rows: Array<Array<string | number>> = [["ID", "Category", "Amount", "Date"]];
    for (let i = 1; i <= size; i++) {
      rows.push([
        `ID-${i}`,
        `Segment-${i % 8}`,
        (i % 100) * 10,
        `2026-0${(i % 6) + 1}-15`,
      ]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Large");
    const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;

    const start = Date.now();
    const parsed = parseSpreadsheetBuffer(toArrayBuffer(bytes), `large-${size}.xlsx`, bytes.byteLength, "xlsx");
    const config = generateDashboardConfig(parsed.sheets["Large"], `large-${size}.xlsx`);
    const totalRes = computeSummaryCardValue(parsed.sheets["Large"].rows, config.summaryCards[0]);
    const elapsed = Date.now() - start;

    assert.equal(parsed.sheets["Large"].rowCount, size);
    assert.equal(totalRes.value, size);
    assert.ok(elapsed < 15000, `Dataset ${size} took ${elapsed}ms`);
  }
});
