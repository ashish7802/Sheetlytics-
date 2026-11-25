import { parseSpreadsheetBuffer } from "./parser.ts";
import type { ParsedWorkbook } from "../../types/dashboard.ts";

const WORKER_TIMEOUT_MS = 30_000;

function isValidWorkerResponse(
  data: unknown
): data is { ok: boolean; workbook?: ParsedWorkbook; error?: string } {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (typeof record.ok !== "boolean") return false;
  if (record.ok && (!record.workbook || typeof record.workbook !== "object")) return false;
  return true;
}

/**
 * Parses a spreadsheet in a Web Worker with timeout, message validation,
 * and automatic cleanup so large files keep the UI responsive.
 */
export async function parseSpreadsheetAsync(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  fileType: "xlsx" | "xls" | "csv",
  timeoutMs = WORKER_TIMEOUT_MS
): Promise<ParsedWorkbook> {
  if (typeof Worker === "undefined") {
    return parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType);
  }

  return new Promise<ParsedWorkbook>((resolve, reject) => {
    let worker: Worker | null = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
        worker = null;
      }
    };

    try {
      worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      try {
        resolve(parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType));
      } catch (err) {
        reject(err);
      }
      return;
    }

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Spreadsheet parsing timed out. The file may be too large or corrupted."));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!isValidWorkerResponse(event.data)) {
        reject(new Error("Received an invalid response from the spreadsheet parser."));
        return;
      }

      if (event.data.ok && event.data.workbook) {
        resolve(event.data.workbook);
      } else {
        reject(new Error(event.data.error ?? "Failed to parse spreadsheet."));
      }
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      // Fallback to main thread if worker script fails to load
      try {
        resolve(parseSpreadsheetBuffer(buffer, fileName, fileSize, fileType));
      } catch (err) {
        reject(err);
      }
    };

    const copy = buffer.slice(0);
    worker.postMessage({ buffer: copy, fileName, fileSize, fileType }, [copy]);
  });
}
