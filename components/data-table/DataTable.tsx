"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { tryParseNumber } from "@/lib/excel/profiler";
import type {
  ColumnProfile,
  ColumnTableFilter,
  CurrencyPreference,
  DataRow,
} from "@/types/dashboard";

interface DataTableProps {
  columns: ColumnProfile[];
  rows: DataRow[];
  totalRows: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  tableColumnFilters: Record<string, ColumnTableFilter>;
  onTableColumnFilterChange: (colKey: string, filter: ColumnTableFilter | null) => void;
  currencyOverride?: CurrencyPreference;
  defaultSort?: { columnKey: string; desc: boolean };
  onClearAllFilters: () => void;
  hasActiveFilters: boolean;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "in stock": "bg-emerald-50 text-emerald-700 border-emerald-200",
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  qualified: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "proposal sent": "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "low stock": "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-violet-50 text-violet-700 border-violet-200",
  new: "bg-sky-50 text-sky-700 border-sky-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
  fail: "bg-rose-50 text-rose-700 border-rose-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  "out of stock": "bg-rose-50 text-rose-700 border-rose-200",
};

export function DataTable({
  columns,
  rows,
  totalRows,
  searchQuery,
  onSearchChange,
  tableColumnFilters,
  onTableColumnFilterChange,
  currencyOverride = "AUTO",
  defaultSort,
  onClearAllFilters,
  hasActiveFilters,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>(
    defaultSort ? [{ id: defaultSort.columnKey, desc: defaultSort.desc }] : []
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const [showColumnFilterRow, setShowColumnFilterRow] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  // Reset pagination to page 0 whenever filtered rows or search change
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [rows.length, searchQuery]);

  const tableColumns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: col.label,
        size: col.type === "email" || col.type === "text" ? 200 : 150,
        minSize: 90,
        maxSize: 480,
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId);
          const b = rowB.getValue(columnId);
          if (a === null || a === undefined) return 1;
          if (b === null || b === undefined) return -1;
          if (col.type === "number" || col.type === "currency" || col.type === "percentage") {
            const na = tryParseNumber(a as string | number);
            const nb = tryParseNumber(b as string | number);
            if (na !== null && nb !== null) return na - nb;
          }
          return String(a).localeCompare(String(b));
        },
        cell: ({ getValue }) => {
          const val = getValue();
          if (val === null || val === undefined || String(val).trim() === "") {
            return <span className="text-slate-300 italic text-xs">—</span>;
          }

          if (col.type === "currency") {
            const num = tryParseNumber(val as string | number);
            if (num !== null) {
              const code =
                currencyOverride !== "AUTO" ? currencyOverride : (col.currencyCode ?? "USD");
              return (
                <span className="font-mono text-xs text-slate-800">
                  {formatCurrency(num, false, code)}
                </span>
              );
            }
          }

          if (col.type === "number") {
            const num = tryParseNumber(val as string | number);
            if (num !== null) {
              return <span className="font-mono text-xs text-slate-800">{formatNumber(num)}</span>;
            }
          }

          if (col.type === "status" || col.role === "status") {
            const str = String(val);
            const badgeClass =
              STATUS_BADGE_COLORS[str.toLowerCase()] ??
              "bg-slate-100 text-slate-700 border-slate-200";
            return (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                  badgeClass
                )}
              >
                {str}
              </span>
            );
          }

          if (col.type === "email") {
            return (
              <span className="text-xs text-indigo-600 font-medium truncate block">
                {String(val)}
              </span>
            );
          }

          return <span className="text-xs text-slate-700">{String(val)}</span>;
        },
      })),
    [columns, currencyOverride]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  const activeTableFilterCount = Object.keys(tableColumnFilters).length;

  return (
    <div
      data-testid="mandatory-data-table"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden"
    >
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Data Explorer</h2>
          <p className="text-xs text-slate-500" data-testid="table-row-count">
            Showing{" "}
            <span className="font-semibold text-slate-700">{rows.length.toLocaleString()}</span>{" "}
            {rows.length !== totalRows && <>of {totalRows.toLocaleString()} total </>}
            records • {columns.length} columns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search all columns..."
              aria-label="Search all columns"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowColumnFilterRow((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
              showColumnFilterRow || activeTableFilterCount > 0
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Column Filters
            {activeTableFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
                {activeTableFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Clear filters
            </button>
          )}

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>

            {isColMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsColMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-2 z-30 max-h-72 overflow-y-auto">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Toggle Columns
                  </div>
                  {table.getAllLeafColumns().map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{String(column.columnDef.header)}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="overflow-x-auto max-h-[540px]">
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth: table.getCenterTotalSize() }}
        >
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                      >
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </button>

                      {/* Column Resize Handle */}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-1 bottom-1 w-1 cursor-col-resize rounded hover:bg-indigo-400",
                          header.column.getIsResizing() && "bg-indigo-600"
                        )}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}

            {/* Per-Column Filter Row */}
            {showColumnFilterRow && (
              <tr className="bg-white border-t border-slate-200 no-print">
                {table.getVisibleLeafColumns().map((col) => {
                  const profile = columns.find((c) => c.key === col.id);
                  const current = tableColumnFilters[col.id];
                  const isNumeric =
                    profile?.type === "number" ||
                    profile?.type === "currency" ||
                    profile?.type === "percentage";

                  return (
                    <th key={`filter-${col.id}`} className="px-2 py-2 font-normal">
                      <div className="flex flex-col gap-1">
                        {isNumeric ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="Min"
                              aria-label={`Min ${profile?.label}`}
                              value={current?.mode === "range" ? (current.min ?? "") : ""}
                              onChange={(e) => {
                                const min = e.target.value;
                                const max = current?.mode === "range" ? current.max : undefined;
                                if (!min && !max) {
                                  onTableColumnFilterChange(col.id, null);
                                } else {
                                  onTableColumnFilterChange(col.id, {
                                    mode: "range",
                                    min,
                                    max,
                                  });
                                }
                              }}
                              className="w-16 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-400"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              aria-label={`Max ${profile?.label}`}
                              value={current?.mode === "range" ? (current.max ?? "") : ""}
                              onChange={(e) => {
                                const max = e.target.value;
                                const min = current?.mode === "range" ? current.min : undefined;
                                if (!min && !max) {
                                  onTableColumnFilterChange(col.id, null);
                                } else {
                                  onTableColumnFilterChange(col.id, {
                                    mode: "range",
                                    min,
                                    max,
                                  });
                                }
                              }}
                              className="w-16 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-400"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="Filter..."
                            aria-label={`Filter ${profile?.label ?? col.id}`}
                            value={current?.mode === "contains" ? (current.text ?? "") : ""}
                            onChange={(e) => {
                              const text = e.target.value;
                              if (!text) {
                                onTableColumnFilterChange(col.id, null);
                              } else {
                                onTableColumnFilterChange(col.id, {
                                  mode: "contains",
                                  text,
                                });
                              }
                            }}
                            className="w-full min-w-[90px] rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-400"
                          />
                        )}

                        <select
                          aria-label={`Blank filter for ${profile?.label ?? col.id}`}
                          value={
                            current?.mode === "blank_only" || current?.mode === "non_blank"
                              ? current.mode
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "blank_only" || val === "non_blank") {
                              onTableColumnFilterChange(col.id, { mode: val });
                            } else {
                              onTableColumnFilterChange(col.id, null);
                            }
                          }}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 focus:outline-none"
                        >
                          <option value="">All values</option>
                          <option value="blank_only">Blank only</option>
                          <option value="non_blank">Non-blank only</option>
                        </select>
                      </div>
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  No records match your current search or filter criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-3 whitespace-nowrap max-w-xs truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 no-print">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
          >
            {[10, 15, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Page <span className="font-semibold text-slate-800">{pagination.pageIndex + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {Math.max(table.getPageCount(), 1)}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
