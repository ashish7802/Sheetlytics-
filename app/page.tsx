"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DropzoneUpload } from "@/components/upload/DropzoneUpload";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";
import { parseSpreadsheetAsync } from "@/lib/excel/parse-async";
import { getSampleWorkbook, type SampleDatasetMeta } from "@/lib/excel/samples";
import {
  buildDashboardStorageId,
  clearActiveDashboardSession,
  clearAllSavedDashboards,
  listSavedDashboards,
  loadActiveDashboard,
  saveDashboardLocally,
  type SavedDashboardEntry,
} from "@/lib/dashboard/persistence";
import { generateDashboardConfig } from "@/lib/analytics/engine";
import type { DashboardConfig, ParsedWorkbook } from "@/types/dashboard";

export default function HomePage() {
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [initialConfig, setInitialConfig] = useState<DashboardConfig | undefined>(undefined);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore active dashboard & saved list on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [active, list] = await Promise.all([
        loadActiveDashboard(),
        listSavedDashboards(),
      ]);
      if (!mounted) return;
      setSavedDashboards(list);
      if (active) {
        setWorkbook(active.workbook);
        setInitialConfig(active.config);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistEntry = useCallback(
    async (wb: ParsedWorkbook, cfg: DashboardConfig) => {
      const sheet = wb.sheets[cfg.activeSheetName] ?? wb.sheets[wb.sheetNames[0]];
      const entry: SavedDashboardEntry = {
        id: buildDashboardStorageId(wb.fileName, wb.fileSize),
        fileName: wb.fileName,
        title: cfg.title,
        rowCount: sheet?.rowCount ?? 0,
        columnCount: sheet?.columnCount ?? 0,
        updatedAt: new Date().toISOString(),
        workbook: wb,
        config: cfg,
      };
      await saveDashboardLocally(entry);
      const list = await listSavedDashboards();
      setSavedDashboards(list);
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File, extension: "xlsx" | "xls" | "csv") => {
      setIsLoading(true);
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await parseSpreadsheetAsync(buffer, file.name, file.size, extension);
        const firstSheet = parsed.sheets[parsed.sheetNames[0]];
        const cfg = generateDashboardConfig(firstSheet, parsed.fileName);
        setOriginalFile(file);
        setInitialConfig(cfg);
        setWorkbook(parsed);
        await persistEntry(parsed, cfg);
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
    [persistEntry]
  );

  const handleLoadSample = useCallback(
    async (sampleId: SampleDatasetMeta["id"]) => {
      setError(null);
      setOriginalFile(null);
      const parsed = getSampleWorkbook(sampleId);
      const firstSheet = parsed.sheets[parsed.sheetNames[0]];
      const cfg = generateDashboardConfig(firstSheet, parsed.fileName);
      setInitialConfig(cfg);
      setWorkbook(parsed);
      await persistEntry(parsed, cfg);
    },
    [persistEntry]
  );

  const handleLoadSaved = useCallback(async (entry: SavedDashboardEntry) => {
    setError(null);
    setOriginalFile(null);
    setInitialConfig(entry.config);
    setWorkbook(entry.workbook);
    await saveDashboardLocally(entry);
  }, []);

  const handleClearSaved = useCallback(async () => {
    await clearAllSavedDashboards();
    setSavedDashboards([]);
  }, []);

  const handleConfigChange = useCallback(
    (nextConfig: DashboardConfig) => {
      if (!workbook) return;
      void persistEntry(workbook, nextConfig);
    },
    [persistEntry, workbook]
  );

  const handleReset = useCallback(() => {
    clearActiveDashboardSession();
    setWorkbook(null);
    setInitialConfig(undefined);
    setOriginalFile(null);
    setError(null);
  }, []);

  if (!workbook) {
    return (
      <DropzoneUpload
        onFileSelected={handleFileSelected}
        onLoadSample={handleLoadSample}
        savedDashboards={savedDashboards}
        onLoadSaved={handleLoadSaved}
        onClearSaved={handleClearSaved}
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
      initialConfig={initialConfig}
      originalFile={originalFile}
      onConfigChange={handleConfigChange}
      onReset={handleReset}
    />
  );
}
