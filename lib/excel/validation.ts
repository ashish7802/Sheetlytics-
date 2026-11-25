import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export const SUPPORTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
  "", // Some browsers omit MIME type for .csv or .xlsx
]);

export const FileValidationSchema = z.object({
  name: z.string().min(1, "File name is required."),
  size: z
    .number()
    .positive("The uploaded file is empty (0 bytes).")
    .max(MAX_FILE_SIZE_BYTES, "File exceeds the 50 MB size limit."),
  type: z.string(),
});

export interface FileValidationResult {
  valid: boolean;
  extension?: "xlsx" | "xls" | "csv";
  error?: string;
}

export function validateSpreadsheetFile(file: {
  name: string;
  size: number;
  type: string;
}): FileValidationResult {
  const parsed = FileValidationSchema.safeParse(file);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error.issues[0]?.message ?? "Invalid file.",
    };
  }

  const lowerName = file.name.toLowerCase();
  const matchedExt = SUPPORTED_EXTENSIONS.find((ext) => lowerName.endsWith(ext));

  if (!matchedExt) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload an .xlsx, .xls, or .csv file.",
    };
  }

  if (file.type && !SUPPORTED_MIME_TYPES.has(file.type)) {
    // Allow if extension is valid and MIME is generic octet-stream, otherwise warn/reject
    if (file.type !== "application/octet-stream") {
      return {
        valid: false,
        error: `Unexpected file MIME type (${file.type}). Please upload a valid Excel or CSV file.`,
      };
    }
  }

  return {
    valid: true,
    extension: matchedExt.slice(1) as "xlsx" | "xls" | "csv",
  };
}
