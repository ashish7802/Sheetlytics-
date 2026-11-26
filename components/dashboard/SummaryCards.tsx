"use client";

import React, { useState } from "react";
import {
  Pencil,
  Check,
  Hash,
  Layers,
  Mail,
  DollarSign,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { computeSummaryCardValue } from "@/lib/analytics/engine";
import { cn } from "@/lib/utils";
import type { CurrencyPreference, DataRow, SummaryCardConfig } from "@/types/dashboard";

interface SummaryCardsProps {
  cards: SummaryCardConfig[];
  filteredRows: DataRow[];
  totalRows: number;
  currencyOverride?: CurrencyPreference;
  onRenameCard: (cardId: string, newTitle: string) => void;
  onRemoveCard?: (cardId: string) => void;
}

const ACCENT_STYLES: Record<SummaryCardConfig["accent"], { bar: string; iconBg: string }> = {
  indigo: { bar: "bg-indigo-600", iconBg: "bg-indigo-50 text-indigo-600" },
  blue: { bar: "bg-blue-600", iconBg: "bg-blue-50 text-blue-600" },
  violet: { bar: "bg-violet-600", iconBg: "bg-violet-50 text-violet-600" },
  emerald: { bar: "bg-emerald-600", iconBg: "bg-emerald-50 text-emerald-600" },
  amber: { bar: "bg-amber-500", iconBg: "bg-amber-50 text-amber-600" },
};

function CardIcon({ card }: { card: SummaryCardConfig }) {
  if (card.format === "currency") return <DollarSign className="h-4 w-4" />;
  if (card.aggregation === "unique") return <Layers className="h-4 w-4" />;
  if (card.aggregation === "non_empty") return <Mail className="h-4 w-4" />;
  if (card.aggregation === "avg" || card.aggregation === "min" || card.aggregation === "max") {
    return <TrendingUp className="h-4 w-4" />;
  }
  return <Hash className="h-4 w-4" />;
}

export function SummaryCards({
  cards,
  filteredRows,
  totalRows,
  currencyOverride = "AUTO",
  onRenameCard,
  onRemoveCard,
}: SummaryCardsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  if (cards.length === 0) return null;

  const isFiltered = filteredRows.length !== totalRows;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const { formatted } = computeSummaryCardValue(filteredRows, card, currencyOverride);
        const accent = ACCENT_STYLES[card.accent] ?? ACCENT_STYLES.indigo;
        const isEditing = editingId === card.id;

        return (
          <div
            key={card.id}
            data-testid={`summary-card-${card.id}`}
            className="group relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow overflow-hidden print-break-inside-avoid"
          >
            <div className={cn("absolute top-0 left-0 right-0 h-1", accent.bar)} />

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draftTitle.trim()) {
                        onRenameCard(card.id, draftTitle.trim());
                      }
                      setEditingId(null);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      autoFocus
                      className="w-full text-xs font-medium text-slate-700 border border-indigo-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="submit"
                      className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                      aria-label="Save card title"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">
                      {card.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(card.id);
                        setDraftTitle(card.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-opacity no-print"
                      aria-label={`Rename ${card.title}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {onRemoveCard && (
                      <button
                        type="button"
                        onClick={() => onRemoveCard(card.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition-opacity no-print"
                        aria-label={`Remove ${card.title}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", accent.iconBg)}>
                <CardIcon card={card} />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatted}
              </p>
              {isFiltered && card.aggregation === "count" && (
                <span className="text-xs text-slate-400 font-mono">
                  of {totalRows.toLocaleString()}
                </span>
              )}
            </div>

            {card.subtitle && (
              <p className="mt-1.5 text-xs text-slate-500 truncate">{card.subtitle}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
