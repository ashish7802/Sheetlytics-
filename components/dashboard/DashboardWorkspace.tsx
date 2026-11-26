"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Plus,
} from "lucide-react";
import {
  applyDashboardFilters,
  ensureTableSection,
  generateDashboardConfig,
} from "@/lib/analytics/engine";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { DataTable } from "@/components/data-table/DataTable";
import { ExportMenu } from "@/components/export/ExportMenu";
import { CategoryFilterPopover } from "@/components/dashboard/CategoryFilterPopover";
import { ColumnInsightsPanel } from "@/components/dashboard/ColumnInsightsPanel";
import { cn } from "@/lib/utils";
import type {
  ColumnTableFilter,
  CurrencyPreference,
  DashboardConfig,
  DashboardFilterState,
  DashboardSectionId,
  DateFormatPreference,
  ParsedWorkbook,
  SummaryCardAggregation,
  SummaryCardConfig,
  SummaryCardFormat,
} from "@/types/dashboard";

interface DashboardWorkspaceProps {
  workbook: ParsedWorkbook;
  initialConfig?: DashboardConfig;
  originalFile: File | null;
  onConfigChange?: (config: DashboardConfig) => void;
  onReset: () => void;
}

const SECTION_LABELS: Record<DashboardSectionId, string> = {
  summary: "Summary Cards",
  table: "Data Explorer Table (Mandatory)",
};

export function DashboardWorkspace({
  workbook,
  initialConfig,
  originalFile,
  onConfigChange,
  onReset,
}: DashboardWorkspaceProps) {
  const firstSheet = workbook.sheets[workbook.sheetNames[0]];
  const [config, setConfig] = useState<DashboardConfig>(() => {
    const base = initialConfig ?? generateDashboardConfig(firstSheet, workbook.fileName);
    return {
      ...base,
      sectionOrder: ensureTableSection(base.sectionOrder),
    };
  });

  const [filters, setFilters] = useState<DashboardFilterState>({
    search: "",
    columnFilters: {},
    tableColumnFilters: {},
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.title);
  const [showSchema, setShowSchema] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Add Summary Card modal state
  const [newCardTitle, setNewCardTitle] = useState("Custom Metric");
  const [newCardAgg, setNewCardAgg] = useState<SummaryCardAggregation>("sum");
  const [newCardCol, setNewCardCol] = useState("");
  const [newCardFormat, setNewCardFormat] = useState<SummaryCardFormat>("number");

  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  const activeSheet = workbook.sheets[config.activeSheetName] ?? firstSheet;

  const handleSheetChange = (sheetName: string) => {
    const nextSheet = workbook.sheets[sheetName];
    if (!nextSheet) return;
    setConfig(generateDashboardConfig(nextSheet, workbook.fileName));
    setFilters({ search: "", columnFilters: {}, tableColumnFilters: {} });
  };

  const filteredRows = useMemo(
    () =>
      applyDashboardFilters(
        activeSheet,
        filters,
        config.dateFormatPreference ?? "auto"
      ),
    [activeSheet, filters, config.dateFormatPreference]
  );

  // Surface up to 4 filterable categorical/status columns
  const filterableColumns = useMemo(
    () =>
      activeSheet.columns
        .filter(
          (c) =>
            (c.type === "category" || c.type === "status" || c.role === "location") &&
            c.uniqueCount >= 1 &&
            c.uniqueCount <= 200
        )
        .slice(0, 4),
    [activeSheet.columns]
  );

  const primaryDateCol = useMemo(
    () => activeSheet.columns.find((c) => c.type === "date"),
    [activeSheet.columns]
  );

  const hasAmbiguousDates = useMemo(
    () => activeSheet.columns.some((c) => c.dateStats?.hasAmbiguousDates),
    [activeSheet.columns]
  );

  const hasActiveFilters = Boolean(
    filters.search.trim() ||
      Object.values(filters.columnFilters).some((v) => v.length > 0) ||
      Object.keys(filters.tableColumnFilters ?? {}).length > 0 ||
      filters.dateRange?.from ||
      filters.dateRange?.to
  );

  const clearAllFilters = () => {
    setFilters({ search: "", columnFilters: {}, tableColumnFilters: {} });
  };

  const handleTableColumnFilterChange = (
    colKey: string,
    filter: ColumnTableFilter | null
  ) => {
    setFilters((prev) => {
      const next = { ...(prev.tableColumnFilters ?? {}) };
      if (!filter) {
        delete next[colKey];
      } else {
        next[colKey] = filter;
      }
      return { ...prev, tableColumnFilters: next };
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const currentOrder = ensureTableSection(config.sectionOrder);
    if (target < 0 || target >= currentOrder.length) return;
    setConfig((prev) => {
      const nextOrder = ensureTableSection(prev.sectionOrder);
      const [item] = nextOrder.splice(index, 1);
      nextOrder.splice(target, 0, item);
      return { ...prev, sectionOrder: ensureTableSection(nextOrder) };
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

  const handleRemoveCard = (cardId: string) => {
    setConfig((prev) => ({
      ...prev,
      summaryCards: prev.summaryCards.filter((c) => c.id !== cardId),
    }));
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCol = activeSheet.columns.find((c) => c.key === newCardCol);
    const card: SummaryCardConfig = {
      id: `card-custom-${Date.now()}`,
      title: newCardTitle.trim() || "Summary Metric",
      subtitle: selectedCol ? `${newCardAgg.toUpperCase()} of ${selectedCol.label}` : "Row count",
      columnKey: newCardAgg === "count" ? undefined : newCardCol || undefined,
      aggregation: newCardAgg,
      format: newCardFormat,
      currencyCode: selectedCol?.currencyCode,
      accent: "indigo",
    };
    setConfig((prev) => ({
      ...prev,
      summaryCards: [...prev.summaryCards, card],
    }));
    setIsAddCardOpen(false);
  };

  const orderedSections = ensureTableSection(config.sectionOrder);

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
                  aria-label="Select worksheet"
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
              currencyOverride={config.currencyOverride ?? "AUTO"}
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
        {/* Workbook Warnings + Ambiguous Date Notice */}
        {(workbook.warnings.length > 0 || hasAmbiguousDates) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5 no-print">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              {workbook.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              {hasAmbiguousDates && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Ambiguous numeric dates detected (e.g. 01/02/2026). Select date order:
                  </span>
                  <select
                    aria-label="Date format preference"
                    value={config.dateFormatPreference ?? "auto"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        dateFormatPreference: e.target.value as DateFormatPreference,
                      }))
                    }
                    className="rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-950"
                  >
                    <option value="auto">Auto (MM/DD/YYYY)</option>
                    <option value="MDY">MM/DD/YYYY (US)</option>
                    <option value="DMY">DD/MM/YYYY (International)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Column Insights & Data Quality Panel */}
        {showSchema && (
          <ColumnInsightsPanel
            columns={activeSheet.columns}
            filteredRows={filteredRows}
            currencyOverride={config.currencyOverride ?? "AUTO"}
            dateFormatPreference={config.dateFormatPreference ?? "auto"}
            onClose={() => setShowSchema(false)}
          />
        )}

        {/* Layout & Display Customization Panel */}
        {showCustomize && (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4 no-print">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Dashboard Layout & Display Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Customize summary cards, section order, table sorting, and display currency. The
                  Data Explorer table is always preserved.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCardCol(activeSheet.columns[0]?.key ?? "");
                    setNewCardTitle("Custom Metric");
                    setIsAddCardOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  <Plus className="h-3 w-3" />
                  Add Summary Card
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfig(generateDashboardConfig(activeSheet, workbook.fileName));
                    setFilters({ search: "", columnFilters: {}, tableColumnFilters: {} });
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-600">Section Order</span>
                <div className="space-y-1.5">
                  {orderedSections.map((secId, idx) => (
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
                          disabled={idx === orderedSections.length - 1}
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

              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-600">Display Currency</span>
                <select
                  aria-label="Display Currency"
                  value={config.currencyOverride ?? "AUTO"}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      currencyOverride: e.target.value as CurrencyPreference,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
                >
                  <option value="AUTO">Auto-detect from spreadsheet</option>
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
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

            {filterableColumns.map((col) => (
              <CategoryFilterPopover
                key={col.key}
                column={col}
                selectedValues={filters.columnFilters[col.key] ?? []}
                onChange={(nextValues) =>
                  setFilters((prev) => ({
                    ...prev,
                    columnFilters: {
                      ...prev.columnFilters,
                      [col.key]: nextValues,
                    },
                  }))
                }
              />
            ))}

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

        {/* Ordered Chart-Free Dashboard Sections (Summary Cards + Mandatory Data Table) */}
        {orderedSections.map((sectionId) => {
          if (sectionId === "summary") {
            return (
              <section key="summary">
                <SummaryCards
                  cards={config.summaryCards}
                  filteredRows={filteredRows}
                  totalRows={activeSheet.rowCount}
                  currencyOverride={config.currencyOverride ?? "AUTO"}
                  onRenameCard={handleRenameCard}
                  onRemoveCard={handleRemoveCard}
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
                tableColumnFilters={filters.tableColumnFilters ?? {}}
                onTableColumnFilterChange={handleTableColumnFilterChange}
                currencyOverride={config.currencyOverride ?? "AUTO"}
                defaultSort={config.defaultSort}
                onClearAllFilters={clearAllFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </section>
          );
        })}
      </main>

      {/* Add Summary Card Modal */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Add Summary Card</h3>
              <button
                type="button"
                onClick={() => setIsAddCardOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-3.5 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Card Title</span>
                <input
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Aggregation</span>
                  <select
                    value={newCardAgg}
                    onChange={(e) => setNewCardAgg(e.target.value as SummaryCardAggregation)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="count">Total Rows</option>
                    <option value="unique">Unique Count</option>
                    <option value="non_empty">Populated Count</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Format</span>
                  <select
                    value={newCardFormat}
                    onChange={(e) => setNewCardFormat(e.target.value as SummaryCardFormat)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="number">Number</option>
                    <option value="currency">Currency</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </label>
              </div>

              {newCardAgg !== "count" && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Column</span>
                  <select
                    value={newCardCol}
                    onChange={(e) => setNewCardCol(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    {activeSheet.columns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} ({c.type})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCardOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
