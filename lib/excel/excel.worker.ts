import { parseSpreadsheetBuffer } from "@/lib/excel/parser";

export interface WorkerParseRequest {
  buffer: ArrayBuffer;
  fileName: string;
  fileSize: number;
  fileType: "xlsx" | "xls" | "csv";
}

self.onmessage = (event: MessageEvent<WorkerParseRequest>) => {
  const { buffer, fileName, fileSize, fileType } = event.data;
  try {
    const workbook = parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType);
    self.postMessage({ ok: true, workbook });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse spreadsheet.";
    self.postMessage({ ok: false, error: message });
  }
};
