"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  AlertCircle,
  Loader2,
  ShieldCheck,
  BarChart3,
  Table2,
  Download,
  Sparkles,
  ArrowRight,
  History,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validateSpreadsheetFile } from "@/lib/excel/validation";
import { SAMPLE_DATASETS, type SampleDatasetMeta } from "@/lib/excel/samples";
import type { SavedDashboardEntry } from "@/lib/dashboard/persistence";

interface DropzoneUploadProps {
  onFileSelected: (file: File, extension: "xlsx" | "xls" | "csv") => Promise<void>;
  onLoadSample: (sampleId: SampleDatasetMeta["id"]) => void;
  savedDashboards?: SavedDashboardEntry[];
  onLoadSaved?: (entry: SavedDashboardEntry) => void;
  onClearSaved?: () => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function DropzoneUpload({
  onFileSelected,
  onLoadSample,
  savedDashboards = [],
  onLoadSaved,
  onClearSaved,
  isLoading,
  error,
  onClearError,
}: DropzoneUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = error || localError;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setLocalError(null);
      onClearError();

      const file = files[0];
      const validation = validateSpreadsheetFile({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (!validation.valid || !validation.extension) {
        setLocalError(validation.error ?? "Invalid file.");
        return;
      }

      await onFileSelected(file, validation.extension);
    },
    [onClearError, onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isLoading) return;
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles, isLoading]
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 tracking-tight text-lg">
                SheetPulse
              </span>
              <span className="ml-2 hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                100% Client-Side
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Files stay in your browser
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Turn any Excel or CSV file into an interactive dashboard
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Upload your spreadsheet and instantly get summary metrics, interactive charts, and a
            searchable data table—powered by deterministic data profiling with zero setup.
          </p>
        </section>

        {/* Upload Dropzone Card */}
        <section className="max-w-3xl mx-auto">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isLoading) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => !isLoading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isLoading) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            aria-label="Upload Excel or CSV spreadsheet"
            className={cn(
              "relative rounded-2xl border-2 border-dashed bg-white p-8 sm:p-12 text-center transition-all cursor-pointer shadow-sm",
              isDragging
                ? "border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10"
                : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50",
              isLoading && "pointer-events-none opacity-80"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="flex flex-col items-center gap-4">
              {isLoading ? (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      Processing spreadsheet...
                    </p>
                    <p className="text-sm text-slate-500">
                      Detecting column types, calculating statistics, and building your dashboard.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base sm:text-lg font-semibold text-slate-900">
                      Drag and drop your spreadsheet here
                    </p>
                    <p className="text-sm text-slate-500">
                      Supports <span className="font-medium text-slate-700">.xlsx</span>,{" "}
                      <span className="font-medium text-slate-700">.xls</span>, and{" "}
                      <span className="font-medium text-slate-700">.csv</span> up to 50 MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                    className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20"
                  >
                    Browse Files
                  </button>
                </>
              )}
            </div>
          </div>

          {activeError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Could not process file</p>
                <p className="text-red-700 mt-0.5">{activeError}</p>
              </div>
            </div>
          )}
        </section>

        {/* Saved Dashboards (Browser-Local) */}
        {savedDashboards.length > 0 && onLoadSaved && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-600" />
                Recent Local Dashboards
              </h2>
              {onClearSaved && (
                <button
                  type="button"
                  onClick={onClearSaved}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Saved
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedDashboards.slice(0, 6).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onLoadSaved(entry)}
                  className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-slate-900 truncate">
                      {entry.title}
                    </p>
                    <p className="text-xs font-mono text-slate-500 truncate">{entry.fileName}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {entry.rowCount.toLocaleString()} rows • {entry.columnCount} cols
                    </span>
                    <span className="text-indigo-600 font-medium">Restore →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sample Datasets */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Explore with a sample spreadsheet
              </h2>
              <p className="text-sm text-slate-500">
                Try an instant dashboard with realistic data—no file upload required.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_DATASETS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={isLoading}
                onClick={() => onLoadSample(sample.id)}
                className="group text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
                      {sample.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {sample.rowCount} rows
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {sample.name}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{sample.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-indigo-600">
                  Load sample dashboard
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-slate-200/80 pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 text-center mb-6">
            How SheetPulse Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Table2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">1. Automatic Profiling</h3>
              <p className="text-sm text-slate-500">
                Detects numbers, currencies, dates, emails, statuses, and categories across multiple
                worksheets while preserving every row.
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">2. Deterministic Charts</h3>
              <p className="text-sm text-slate-500">
                Builds accurate KPI cards and interactive Recharts visualizations tailored to your
                columns—with full manual customization.
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">3. Filter & Export</h3>
              <p className="text-sm text-slate-500">
                Search, sort, and filter live across charts and tables, then export filtered results
                to CSV, Excel, or PDF.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
