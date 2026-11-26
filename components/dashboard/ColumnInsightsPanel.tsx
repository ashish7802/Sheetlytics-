"use client";

import React, { useMemo } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { tryParseDateIso, tryParseNumber } from "@/lib/excel/profiler";
import { cn, formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";
import type {
  ColumnProfile,
  CurrencyPreference,
  DataRow,
  DateFormatPreference,
} from "@/types/dashboard";

interface ColumnInsightsPanelProps {
  columns: ColumnProfile[];
  filteredRows: DataRow[];
  currencyOverride?: CurrencyPreference;
  dateFormatPreference?: DateFormatPreference;
  onClose: () => void;
}

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

export function ColumnInsightsPanel({
  columns,
  filteredRows,
  currencyOverride = "AUTO",
  dateFormatPreference = "auto",
  onClose,
}: ColumnInsightsPanelProps) {
  const insights = useMemo(() => {
    let totalCells = 0;
    let populatedCells = 0;

    const perColumn = columns.map((col) => {
      let nonEmpty = 0;
      let missing = 0;
      const distinct = new Map<string, number>();
      const nums: number[] = [];
      const dates: string[] = [];

      const allowSerial = /\b(date|created|updated|joined|dob|timestamp)\b/.test(
        col.label.toLowerCase()
      );

      for (const row of filteredRows) {
        totalCells++;
        const raw = row[col.key];
        if (raw === null || raw === undefined || String(raw).trim() === "") {
          missing++;
          continue;
        }
        nonEmpty++;
        populatedCells++;
        const str = String(raw).trim();
        distinct.set(str, (distinct.get(str) ?? 0) + 1);

        if (col.type === "number" || col.type === "currency" || col.type === "percentage") {
          const n = tryParseNumber(raw);
          if (n !== null) nums.push(n);
        } else if (col.type === "date") {
          const iso = tryParseDateIso(raw, dateFormatPreference, allowSerial);
          if (iso) dates.push(iso);
        }
      }

      let numericSummary:
        | { sum: number; avg: number; min: number; max: number; validCount: number }
        | undefined;
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        numericSummary = {
          sum,
          avg: sum / nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          validCount: nums.length,
        };
      }

      let dateSummary: { minIso: string; maxIso: string } | undefined;
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        dateSummary = { minIso: sorted[0], maxIso: sorted[sorted.length - 1] };
      }

      const topValues = Array.from(distinct.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      return {
        col,
        nonEmpty,
        missing,
        uniqueCount: distinct.size,
        numericSummary,
        dateSummary,
        topValues,
      };
    });

    const completenessPct = totalCells > 0 ? (populatedCells / totalCells) * 100 : 100;
    return { perColumn, completenessPct };
  }, [columns, filteredRows, dateFormatPreference]);

  const formatMetric = (val: number, col: ColumnProfile) => {
    if (col.type === "currency") {
      const code = currencyOverride !== "AUTO" ? currencyOverride : (col.currencyCode ?? "USD");
      return formatCurrency(val, Math.abs(val) >= 100000, code);
    }
    if (col.type === "percentage") return formatPercentage(val);
    return formatNumber(val, { compact: Math.abs(val) >= 100000 });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Column Insights & Data Quality ({columns.length} columns)
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                insights.completenessPct >= 95
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              {insights.completenessPct >= 95 ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {insights.completenessPct.toFixed(1)}% Complete
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Live deterministic breakdown across {filteredRows.length.toLocaleString()} filtered rows.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 self-end sm:self-auto"
          aria-label="Close column insights"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.perColumn.map(
          ({ col, nonEmpty, missing, uniqueCount, numericSummary, dateSummary, topValues }) => (
            <div
              key={col.key}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs space-y-2.5"
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
                  {col.currencyCode ? ` (${col.currencyCode})` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{nonEmpty.toLocaleString()} filled</span>
                <span>{uniqueCount.toLocaleString()} unique</span>
                <span>{missing.toLocaleString()} blank</span>
              </div>

              {numericSummary && (
                <div className="pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sum:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {formatMetric(numericSummary.sum, col)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {formatMetric(numericSummary.avg, col)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Min:</span>
                    <span className="font-mono text-slate-700">
                      {formatMetric(numericSummary.min, col)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max:</span>
                    <span className="font-mono text-slate-700">
                      {formatMetric(numericSummary.max, col)}
                    </span>
                  </div>
                </div>
              )}

              {dateSummary && !numericSummary && (
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Range:</span>
                  <span className="font-mono">
                    {dateSummary.minIso} → {dateSummary.maxIso}
                  </span>
                </div>
              )}

              {!numericSummary && !dateSummary && topValues.length > 0 && (
                <div className="pt-2 border-t border-slate-200/70 space-y-1">
                  {topValues.map(([val, cnt]) => (
                    <div key={val} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-slate-600 truncate">{val}</span>
                      <span className="font-mono text-slate-500 shrink-0">{cnt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}
