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
  // Defer revocation so browsers have time to initiate the download stream
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

async function svgToPngDataUrl(svg: SVGSVGElement): Promise<string | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(rect.width || 480, 300);
    const height = Math.max(rect.height || 260, 180);

    const cloned = svg.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    cloned.setAttribute("width", String(width));
    cloned.setAttribute("height", String(height));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(cloned);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function exportDashboardPdf(
  rows: DataRow[],
  columns: ColumnProfile[],
  summaryCards: SummaryCardConfig[],
  dashboardTitle: string,
  fileName: string,
  currencyOverride: CurrencyPreference = "AUTO"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title Header
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(dashboardTitle, 40, 44);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Source: ${fileName}  •  Filtered Rows: ${rows.length.toLocaleString()}  •  Exported: ${new Date().toLocaleDateString()}`,
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
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;

  // Capture rendered Recharts SVGs from the DOM
  if (typeof document !== "undefined") {
    const chartNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-chart-export]"));
    if (chartNodes.length > 0) {
      cursorY += 20;
      const chartWidth = (pageWidth - 100) / 2;
      const chartHeight = 165;

      for (let i = 0; i < chartNodes.length; i++) {
        const node = chartNodes[i];
        const title = node.getAttribute("data-chart-title") ?? `Chart ${i + 1}`;
        const svg = node.querySelector("svg.recharts-surface") as SVGSVGElement | null;
        if (!svg) continue;

        const pngData = await svgToPngDataUrl(svg);
        if (!pngData) continue;

        const colIdx = i % 2;
        if (colIdx === 0 && cursorY + chartHeight + 30 > pageHeight - 40) {
          doc.addPage();
          cursorY = 40;
        }

        const x = 40 + colIdx * (chartWidth + 20);
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(title, x, cursorY);
        doc.addImage(pngData, "PNG", x, cursorY + 6, chartWidth, chartHeight);

        if (colIdx === 1 || i === chartNodes.length - 1) {
          cursorY += chartHeight + 28;
        }
      }
    }
  }

  // Data Table (paginated by autoTable; disclose if dataset exceeds PDF_MAX_ROWS)
  if (cursorY + 80 > pageHeight - 40) {
    doc.addPage();
    cursorY = 40;
  } else {
    cursorY += 12;
  }

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
