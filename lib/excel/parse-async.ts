import { parseSpreadsheetBuffer } from "@/lib/excel/parser";
import type { ParsedWorkbook } from "@/types/dashboard";

/**
 * Parses a spreadsheet in a Web Worker so large files keep the UI responsive,
 * with a direct fallback when Workers are unavailable.
 */
export async function parseSpreadsheetAsync(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  fileType: "xlsx" | "xls" | "csv"
): Promise<ParsedWorkbook> {
  if (typeof Worker === "undefined") {
    return parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType);
  }

  return new Promise<ParsedWorkbook>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // Fallback to main-thread parsing if worker instantiation fails
      try {
        resolve(parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType));
      } catch (err) {
        reject(err);
      }
      return;
    }

    worker.onmessage = (event: MessageEvent<{ ok: boolean; workbook?: ParsedWorkbook; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.workbook) {
        resolve(event.data.workbook);
      } else {
        reject(new Error(event.data.error ?? "Failed to parse spreadsheet."));
      }
    };

    worker.onerror = () => {
      worker.terminate();
      try {
        resolve(parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType));
      } catch (err) {
        reject(err);
      }
    };

    // Clone buffer for transfer so caller can still retain original file bytes if needed
    const copy = buffer.slice(0);
    worker.postMessage({ buffer: copy, fileName, fileSize, fileType }, [copy]);
  });
}
