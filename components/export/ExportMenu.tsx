"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, FileDown, ChevronDown } from "lucide-react";
import {
  exportDashboardPdf,
  exportFilteredCsv,
  exportFilteredExcel,
  exportOriginalFile,
} from "@/lib/export/exporters";
import type {
  ColumnProfile,
  CurrencyPreference,
  DataRow,
  SummaryCardConfig,
} from "@/types/dashboard";

interface ExportMenuProps {
  originalFile: File | null;
  fileName: string;
  dashboardTitle: string;
  filteredRows: DataRow[];
  columns: ColumnProfile[];
  summaryCards: SummaryCardConfig[];
  currencyOverride?: CurrencyPreference;
}

export function ExportMenu({
  originalFile,
  fileName,
  dashboardTitle,
  filteredRows,
  columns,
  summaryCards,
  currencyOverride = "AUTO",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative no-print">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-xs"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white shadow-xl p-1.5 z-30 text-xs">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Export Filtered View
            </div>

            <button
              type="button"
              onClick={() => {
                exportFilteredCsv(filteredRows, columns, fileName);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <FileDown className="h-4 w-4 text-slate-400" />
              Export Filtered CSV
            </button>

            <button
              type="button"
              onClick={() => {
                exportFilteredExcel(
                  filteredRows,
                  columns,
                  summaryCards,
                  dashboardTitle,
                  fileName,
                  currencyOverride
                );
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Dashboard Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await exportDashboardPdf(
                  filteredRows,
                  columns,
                  summaryCards,
                  dashboardTitle,
                  fileName,
                  currencyOverride
                );
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <FileText className="h-4 w-4 text-rose-500" />
              Export Dashboard PDF
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.print();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <Printer className="h-4 w-4 text-slate-400" />
              Print-Friendly Layout
            </button>

            {originalFile && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    exportOriginalFile(originalFile, fileName);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  Download Original File
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
