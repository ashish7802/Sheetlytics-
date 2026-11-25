"use client";

import React, { useCallback, useState } from "react";
import { DropzoneUpload } from "@/components/upload/DropzoneUpload";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";
import { parseSpreadsheetAsync } from "@/lib/excel/parse-async";
import { getSampleWorkbook, type SampleDatasetMeta } from "@/lib/excel/samples";
import type { ParsedWorkbook } from "@/types/dashboard";

export default function HomePage() {
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = useCallback(
    async (file: File, extension: "xlsx" | "xls" | "csv") => {
      setIsLoading(true);
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await parseSpreadsheetAsync(buffer, file.name, file.size, extension);
        setOriginalFile(file);
        setWorkbook(parsed);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while reading the spreadsheet.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleLoadSample = useCallback((sampleId: SampleDatasetMeta["id"]) => {
    setError(null);
    setOriginalFile(null);
    setWorkbook(getSampleWorkbook(sampleId));
  }, []);

  const handleReset = useCallback(() => {
    setWorkbook(null);
    setOriginalFile(null);
    setError(null);
  }, []);

  if (!workbook) {
    return (
      <DropzoneUpload
        onFileSelected={handleFileSelected}
        onLoadSample={handleLoadSample}
        isLoading={isLoading}
        error={error}
        onClearError={() => setError(null)}
      />
    );
  }

  return (
    <DashboardWorkspace
      key={workbook.fileName + workbook.fileSize}
      workbook={workbook}
      originalFile={originalFile}
      onReset={handleReset}
    />
  );
}
