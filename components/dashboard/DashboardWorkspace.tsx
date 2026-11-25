"use client";

import React, { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  Sliders,
  Pencil,
  Check,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  applyDashboardFilters,
  generateDashboardConfig,
} from "@/lib/analytics/engine";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { DataTable } from "@/components/data-table/DataTable";
import { ExportMenu } from "@/components/export/ExportMenu";
import { cn } from "@/lib/utils";
import type {
  ChartConfig,
  DashboardConfig,
  DashboardFilterState,
  DashboardSectionId,
  ParsedWorkbook,
} from "@/types/dashboard";

interface DashboardWorkspaceProps {
  workbook: ParsedWorkbook;
  originalFile: File | null;
  onReset: () => void;
}

const SECTION_LABELS: Record<DashboardSectionId, string> = {
  summary: "Summary Cards",
  charts: "Visualizations",
  table: "Data Explorer Table",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  number: "bg-blue-50 text-blue-700 border-blue-200",
  currency: "bg-emerald-50 text-emerald-700 border-emerald-200",
  percentage: "bg-violet-50 text-violet-700 border-violet-200",
  date: "bg-amber-50 text-amber-700 border-amber-200",
  email: "bg-indigo-50 text-indigo-700 border-indigo-200",
  status: "bg-pink-50 text-pink-700 border-pink-200",
  category: "bg-sky-50 text-sky-700 border-sky-200",
  boolean: "bg-slate-100 text-slate-700 border-slate-200",
  text: "bg-slate-100 text-slate-600 border-slate-200",
};

export function DashboardWorkspace({
  workbook,
  originalFile,
  onReset,
}: DashboardWorkspaceProps) {
  const initialSheet = workbook.sheets[workbook.sheetNames[0]];
  const [config, setConfig] = useState<DashboardConfig>(() =>
    generateDashboardConfig(initialSheet, workbook.fileName)
  );
  const [filters, setFilters] = useState<DashboardFilterState>({
    search: "",
    columnFilters: {},
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.title);
  const [showSchema, setShowSchema] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const activeSheet = workbook.sheets[config.activeSheetName] ?? initialSheet;

  const handleSheetChange = (sheetName: string) => {
    const nextSheet = workbook.sheets[sheetName];
    if (!nextSheet) return;
    setConfig(generateDashboardConfig(nextSheet, workbook.fileName));
    setFilters({ search: "", columnFilters: {} });
  };

  const filteredRows = useMemo(
    () => applyDashboardFilters(activeSheet, filters),
    [activeSheet, filters]
  );

  // Surface up to 3 filterable categorical/status columns + 1 date column
  const filterableColumns = useMemo(
    () =>
      activeSheet.columns
        .filter(
          (c) =>
            (c.type === "category" || c.type === "status" || c.role === "location") &&
            c.uniqueCount >= 2 &&
            c.uniqueCount <= 30
        )
        .slice(0, 3),
    [activeSheet.columns]
  );

  const primaryDateCol = useMemo(
    () => activeSheet.columns.find((c) => c.type === "date"),
    [activeSheet.columns]
  );

  const hasActiveFilters = Boolean(
    filters.search.trim() ||
      Object.values(filters.columnFilters).some((v) => v.length > 0) ||
      filters.dateRange?.from ||
      filters.dateRange?.to
  );

  const clearAllFilters = () => {
    setFilters({ search: "", columnFilters: {} });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.sectionOrder.length) return;
    setConfig((prev) => {
      const nextOrder = [...prev.sectionOrder];
      const [item] = nextOrder.splice(index, 1);
      nextOrder.splice(target, 0, item);
      return { ...prev, sectionOrder: nextOrder };
    });
  };

  const handleRenameCard = (cardId: string, newTitle: string) => {
    setConfig((prev) => ({
      ...prev,
      summaryCards: prev.summaryCards.map((c) =>
        c.id === cardId ? { ...c, title: newTitle } : c
      ),
    }));
  };

  const handleUpdateChart = (chartId: string, patch: Partial<ChartConfig>) => {
    setConfig((prev) => ({
      ...prev,
      charts: prev.charts.map((c) => (c.id === chartId ? { ...c, ...patch } : c)),
    }));
  };

  const handleRemoveChart = (chartId: string) => {
    setConfig((prev) => ({
      ...prev,
      charts: prev.charts.filter((c) => c.id !== chartId),
    }));
  };

  const handleAddChart = (chart: ChartConfig) => {
    setConfig((prev) => ({
      ...prev,
      charts: [...prev.charts, chart],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Brand + Editable Title + File Info */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draftTitle.trim()) {
                      setConfig((prev) => ({ ...prev, title: draftTitle.trim() }));
                    }
                    setIsEditingTitle(false);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    autoFocus
                    className="text-base sm:text-lg font-bold text-slate-900 border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    aria-label="Save dashboard title"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {config.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(config.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors no-print"
                    aria-label="Rename dashboard"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-slate-600 truncate max-w-[220px]">
                  {workbook.fileName}
                </span>
                <span>•</span>
                <span>{activeSheet.rowCount.toLocaleString()} rows</span>
                <span>•</span>
                <span>{activeSheet.columnCount} columns</span>
              </div>
            </div>
          </div>

          {/* Right: Sheet Selector + Controls */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {workbook.sheetNames.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-slate-500 font-medium">Sheet:</span>
                <select
                  value={activeSheet.name}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {workbook.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSchema((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors",
                showSchema
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              <Info className="h-4 w-4" />
              Columns
            </button>

            <button
              type="button"
              onClick={() => setShowCustomize((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors",
                showCustomize
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              <Sliders className="h-4 w-4" />
              Customize
            </button>

            <ExportMenu
              originalFile={originalFile}
              fileName={workbook.fileName}
              dashboardTitle={config.title}
              filteredRows={filteredRows}
              columns={activeSheet.columns}
              summaryCards={config.summaryCards}
            />

            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Upload className="h-4 w-4" />
              New File
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Workbook Warnings */}
        {workbook.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5 no-print">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {workbook.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Detected Columns & Data Types Panel */}
        {showSchema && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 no-print">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Detected Column Schema ({activeSheet.columns.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Types and missing values detected deterministically from your worksheet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSchema(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {activeSheet.columns.map((col) => (
                <div
                  key={col.key}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate" title={col.label}>
                      {col.label}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border shrink-0",
                        TYPE_BADGE_COLORS[col.type] ?? TYPE_BADGE_COLORS.text
                      )}
                    >
                      {col.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{col.uniqueCount.toLocaleString()} unique</span>
                    <span>{col.missingCount} blank</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Layout Customization Panel */}
        {showCustomize && (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4 no-print">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Dashboard Layout & Defaults</h2>
                <p className="text-xs text-slate-500">
                  Reorder dashboard sections or reset to the auto-generated layout.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfig(generateDashboardConfig(activeSheet, workbook.fileName));
                    setFilters({ search: "", columnFilters: {} });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Layout
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomize(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-600">Section Order</span>
                <div className="space-y-1.5">
                  {config.sectionOrder.map((secId, idx) => (
                    <div
                      key={secId}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800">{SECTION_LABELS[secId]}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          className="p-1 rounded hover:bg-white disabled:opacity-30"
                          aria-label={`Move ${SECTION_LABELS[secId]} up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === config.sectionOrder.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          className="p-1 rounded hover:bg-white disabled:opacity-30"
                          aria-label={`Move ${SECTION_LABELS[secId]} down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-600">Default Table Sort</span>
                <div className="flex items-center gap-2">
                  <select
                    value={config.defaultSort?.columnKey ?? ""}
                    onChange={(e) => {
                      const colKey = e.target.value;
                      setConfig((prev) => ({
                        ...prev,
                        defaultSort: colKey
                          ? { columnKey: colKey, desc: prev.defaultSort?.desc ?? false }
                          : undefined,
                      }));
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">Original Row Order</option>
                    {activeSheet.columns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {config.defaultSort && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) =>
                          prev.defaultSort
                            ? {
                                ...prev,
                                defaultSort: {
                                  ...prev.defaultSort,
                                  desc: !prev.defaultSort.desc,
                                },
                              }
                            : prev
                        )
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {config.defaultSort.desc ? "Desc" : "Asc"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Global Filter Bar */}
        {(filterableColumns.length > 0 || primaryDateCol) && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-wrap items-center gap-3 no-print">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              Filters:
            </div>

            {filterableColumns.map((col) => {
              const selected = filters.columnFilters[col.key] ?? [];
              return (
                <div key={col.key} className="relative group">
                  <select
                    aria-label={`Filter by ${col.label}`}
                    value={selected[0] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        columnFilters: {
                          ...prev.columnFilters,
                          [col.key]: val ? [val] : [],
                        },
                      }));
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer transition-colors",
                      selected.length > 0
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                  >
                    <option value="">All {col.label}</option>
                    {col.sampleValues.map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {primaryDateCol && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">{primaryDateCol.label}:</span>
                <input
                  type="date"
                  aria-label="Filter start date"
                  value={filters.dateRange?.from ?? ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: {
                        columnKey: primaryDateCol.key,
                        from: e.target.value || undefined,
                        to: prev.dateRange?.to,
                      },
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-400"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  aria-label="Filter end date"
                  value={filters.dateRange?.to ?? ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: {
                        columnKey: primaryDateCol.key,
                        from: prev.dateRange?.from,
                        to: e.target.value || undefined,
                      },
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-400"
                />
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </section>
        )}

        {/* Ordered Dashboard Sections */}
        {config.sectionOrder.map((sectionId) => {
          if (sectionId === "summary") {
            return (
              <section key="summary">
                <SummaryCards
                  cards={config.summaryCards}
                  filteredRows={filteredRows}
                  totalRows={activeSheet.rowCount}
                  onRenameCard={handleRenameCard}
                />
              </section>
            );
          }

          if (sectionId === "charts") {
            return (
              <section key="charts">
                <DashboardCharts
                  charts={config.charts}
                  columns={activeSheet.columns}
                  filteredRows={filteredRows}
                  onUpdateChart={handleUpdateChart}
                  onRemoveChart={handleRemoveChart}
                  onAddChart={handleAddChart}
                />
              </section>
            );
          }

          return (
            <section key="table">
              <DataTable
                key={`${activeSheet.name}-${config.defaultSort?.columnKey ?? "none"}-${config.defaultSort?.desc ?? false}`}
                columns={activeSheet.columns}
                rows={filteredRows}
                totalRows={activeSheet.rowCount}
                searchQuery={filters.search}
                onSearchChange={(q) => setFilters((prev) => ({ ...prev, search: q }))}
                defaultSort={config.defaultSort}
                onClearAllFilters={clearAllFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </section>
          );
        })}
      </main>
    </div>
  );
}
