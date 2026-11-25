"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnProfile } from "@/types/dashboard";

interface CategoryFilterPopoverProps {
  column: ColumnProfile;
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
}

export function CategoryFilterPopover({
  column,
  selectedValues,
  onChange,
}: CategoryFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => {
    const opts = [...column.uniqueValues];
    if (column.missingCount > 0 && !opts.includes("(Blank)")) {
      opts.push("(Blank)");
    }
    return opts;
  }, [column.missingCount, column.uniqueValues]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions.slice(0, 200);
    return allOptions.filter((opt) => opt.toLowerCase().includes(q)).slice(0, 200);
  }, [allOptions, query]);

  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Filter by ${column.label}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
          selectedValues.length > 0
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
        )}
      >
        <span className="truncate max-w-[140px]">
          {selectedValues.length === 0
            ? `All ${column.label}`
            : selectedValues.length === 1
            ? `${column.label}: ${selectedValues[0]}`
            : `${column.label} (${selectedValues.length})`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-2.5 z-30 text-xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-semibold text-slate-700 truncate">
                {column.label} ({allOptions.length})
              </span>
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${column.label}...`}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {filteredOptions.length === 0 ? (
                <p className="py-3 text-center text-slate-400">No matching options</p>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = selectedValues.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleValue(opt)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors",
                        checked
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{opt}</span>
                      {checked && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
