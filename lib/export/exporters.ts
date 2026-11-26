import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ColumnProfile,
  CurrencyPreference,
  DataRow,
  SummaryCardConfig,
} from "../../types/dashboard.ts";
import { computeSummaryCardValue } from "../analytics/engine.ts";

const PDF_MAX_ROWS = 500;

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOriginalFile(originalFile: File | null, fallbackName: string) {
  if (!originalFile) return;
  triggerDownload(originalFile, originalFile.name || fallbackName);
}

export function exportFilteredCsv(
  rows: DataRow[],
  columns: ColumnProfile[],
  baseFileName: string
) {
  const headers = columns.map((c) => c.label);
  const matrix = [
    headers,
    ...rows.map((r) =>
      columns.map((c) => {
        const val = r[c.key];
        return val === null || val === undefined ? "" : val;
      })
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const cleanName = baseFileName.replace(/\.(xlsx|xls|csv)$/i, "");
  triggerDownload(blob, `${cleanName}-filtered.csv`);
}

export async function copyFilteredTsv(
  rows: DataRow[],
  columns: ColumnProfile[]
): Promise<boolean> {
  const escapeTsv = (v: unknown) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[\t\r\n]+/g, " ");
  };
  const headerLine = columns.map((c) => escapeTsv(c.label)).join("\t");
  const dataLines = rows.map((r) => columns.map((c) => escapeTsv(r[c.key])).join("\t"));
  const tsv = [headerLine, ...dataLines].join("\n");
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    return false;
  }
}

export function exportFilteredExcel(
  rows: DataRow[],
  columns: ColumnProfile[],
  summaryCards: SummaryCardConfig[],
  dashboardTitle: string,
  baseFileName: string,
  currencyOverride: CurrencyPreference = "AUTO"
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Filtered Data
  const headers = columns.map((c) => c.label);
  const dataMatrix = [
    headers,
    ...rows.map((r) =>
      columns.map((c) => {
        const val = r[c.key];
        return val === null || val === undefined ? "" : val;
      })
    ),
  ];
  const dataSheet = XLSX.utils.aoa_to_sheet(dataMatrix);
  XLSX.utils.book_append_sheet(wb, dataSheet, "Filtered Data");

  // Sheet 2: Summary Metrics
  const summaryRows: Array<Array<string | number>> = [
    ["Dashboard", dashboardTitle],
    ["Exported Rows", rows.length],
    ["Generated At", new Date().toISOString()],
    [],
    ["Metric", "Value", "Description"],
  ];
  for (const card of summaryCards) {
    const { formatted } = computeSummaryCardValue(rows, card, currencyOverride);
    summaryRows.push([card.title, formatted, card.subtitle ?? ""]);
  }
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const cleanName = baseFileName.replace(/\.(xlsx|xls|csv)$/i, "");
  triggerDownload(blob, `${cleanName}-dashboard.xlsx`);
}

/**
 * Exports a clean, chart-free PDF containing the dashboard title, metadata,
 * summary cards table, and paginated data table.
 */
export async function exportDashboardPdf(
  rows: DataRow[],
  columns: ColumnProfile[],
  summaryCards: SummaryCardConfig[],
  dashboardTitle: string,
  fileName: string,
  currencyOverride: CurrencyPreference = "AUTO"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Title Header
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(dashboardTitle, 40, 44);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Source: ${fileName}  •  Filtered Rows: ${rows.length.toLocaleString()}  •  Columns: ${columns.length}  •  Exported: ${new Date().toLocaleDateString()}`,
    40,
    62
  );

  // Summary Metrics Table
  const kpiBody = summaryCards.map((card) => {
    const { formatted } = computeSummaryCardValue(rows, card, currencyOverride);
    return [card.title, formatted, card.subtitle ?? ""];
  });

  if (kpiBody.length > 0) {
    autoTable(doc, {
      startY: 78,
      head: [["Summary Metric", "Value", "Notes"]],
      body: kpiBody,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });
  }

  let cursorY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 78) + 20;

  const exportedRows = rows.slice(0, PDF_MAX_ROWS);
  if (rows.length > PDF_MAX_ROWS) {
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text(
      `Note: PDF table displays the first ${PDF_MAX_ROWS.toLocaleString()} of ${rows.length.toLocaleString()} filtered rows. Export as CSV or Excel for the complete dataset.`,
      40,
      cursorY
    );
    cursorY += 14;
  }

  const pdfCols = columns.slice(0, 12);
  if (columns.length > 12) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Note: Showing first 12 of ${columns.length} columns for landscape PDF readability.`,
      40,
      cursorY
    );
    cursorY += 14;
  }

  const pdfRows = exportedRows.map((r) =>
    pdfCols.map((c) => {
      const val = r[c.key];
      return val === null || val === undefined ? "" : String(val);
    })
  );

  autoTable(doc, {
    startY: cursorY,
    head: [pdfCols.map((c) => c.label)],
    body: pdfRows,
    theme: "striped",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 40, right: 40 },
  });

  const cleanName = fileName.replace(/\.(xlsx|xls|csv)$/i, "");
  doc.save(`${cleanName}-dashboard.pdf`);
}
