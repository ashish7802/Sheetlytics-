"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SlidersHorizontal, Trash2, Plus, X, BarChart3 } from "lucide-react";
import { computeChartData } from "@/lib/analytics/engine";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  ChartAggregation,
  ChartConfig,
  ChartType,
  ColumnProfile,
  CurrencyCode,
  CurrencyPreference,
  DataRow,
  DateFormatPreference,
} from "@/types/dashboard";

const CHART_COLORS = [
  "#4f46e5",
  "#2563eb",
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
];

interface DashboardChartsProps {
  charts: ChartConfig[];
  columns: ColumnProfile[];
  filteredRows: DataRow[];
  currencyOverride?: CurrencyPreference;
  dateFormatPreference?: DateFormatPreference;
  onUpdateChart: (chartId: string, patch: Partial<ChartConfig>) => void;
  onRemoveChart: (chartId: string) => void;
  onAddChart: (chart: ChartConfig) => void;
}

function formatAxisValue(
  val: number,
  isCurrency: boolean,
  currencyCode: CurrencyCode
): string {
  if (isCurrency) return formatCurrency(val, Math.abs(val) >= 10000, currencyCode);
  return formatNumber(val, { compact: Math.abs(val) >= 10000 });
}

export function DashboardCharts({
  charts,
  columns,
  filteredRows,
  currencyOverride = "AUTO",
  dateFormatPreference = "auto",
  onUpdateChart,
  onRemoveChart,
  onAddChart,
}: DashboardChartsProps) {
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const numericColumns = columns.filter(
    (c) => c.type === "number" || c.type === "currency" || c.type === "percentage"
  );

  const [newTitle, setNewTitle] = useState("Custom Visualization");
  const [newType, setNewType] = useState<ChartType>("bar");
  const [newXCol, setNewXCol] = useState(columns[0]?.key ?? "");
  const [newAgg, setNewAgg] = useState<ChartAggregation>("count");
  const [newYCol, setNewYCol] = useState(numericColumns[0]?.key ?? "");

  const handleCreateChart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newXCol) return;
    onAddChart({
      id: `chart-custom-${Date.now()}`,
      title: newTitle.trim() || "Custom Chart",
      type: newType,
      xColumnKey: newXCol,
      yColumnKey: newAgg === "count" ? undefined : newYCol || undefined,
      aggregation: newAgg,
      maxItems: 12,
      dateGranularity: "month",
    });
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Visualizations</h2>
          <p className="text-xs text-slate-500">
            Interactive charts update automatically as you filter the dataset.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewXCol(columns[0]?.key ?? "");
            setNewYCol(numericColumns[0]?.key ?? "");
            setNewTitle("New Visualization");
            setIsAddOpen(true);
          }}
          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Chart
        </button>
      </div>

      {charts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            No charts displayed—your complete data table remains available below.
          </p>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Visualization
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {charts.map((chart) => {
            const data = computeChartData(filteredRows, chart, columns, dateFormatPreference);
            const yCol = columns.find((c) => c.key === chart.yColumnKey);
            const isCurrency = yCol?.type === "currency" && chart.aggregation !== "count";
            const currencyCode: CurrencyCode =
              currencyOverride !== "AUTO" ? currencyOverride : (yCol?.currencyCode ?? "USD");
            const isEditing = editingChartId === chart.id;

            return (
              <div
                key={chart.id}
                data-chart-export="true"
                data-chart-title={chart.title}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col print-break-inside-avoid"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {chart.title}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {chart.aggregation === "count"
                        ? `Count by ${columns.find((c) => c.key === chart.xColumnKey)?.label ?? chart.xColumnKey}`
                        : `${chart.aggregation.toUpperCase()} of ${yCol?.label ?? ""} by ${
                            columns.find((c) => c.key === chart.xColumnKey)?.label ?? chart.xColumnKey
                          }`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 no-print shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingChartId(isEditing ? null : chart.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isEditing
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      }`}
                      title="Customize chart"
                      aria-label="Customize chart"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveChart(chart.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove chart"
                      aria-label="Remove chart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Customization Panel */}
                {isEditing && (
                  <div className="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs no-print">
                    <label className="space-y-1">
                      <span className="font-medium text-slate-600">Chart Title</span>
                      <input
                        type="text"
                        value={chart.title}
                        onChange={(e) => onUpdateChart(chart.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="font-medium text-slate-600">Chart Type</span>
                      <select
                        value={chart.type}
                        onChange={(e) =>
                          onUpdateChart(chart.id, { type: e.target.value as ChartType })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="area">Area Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="doughnut">Doughnut Chart</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="font-medium text-slate-600">Group By (X-Axis)</span>
                      <select
                        value={chart.xColumnKey}
                        onChange={(e) => onUpdateChart(chart.id, { xColumnKey: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                      >
                        {columns.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="font-medium text-slate-600">Aggregation</span>
                      <select
                        value={chart.aggregation}
                        onChange={(e) => {
                          const agg = e.target.value as ChartAggregation;
                          onUpdateChart(chart.id, {
                            aggregation: agg,
                            yColumnKey:
                              agg === "count"
                                ? undefined
                                : chart.yColumnKey ?? numericColumns[0]?.key,
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="count">Count of Rows</option>
                        {numericColumns.length > 0 && (
                          <>
                            <option value="sum">Sum of Metric</option>
                            <option value="avg">Average of Metric</option>
                          </>
                        )}
                      </select>
                    </label>

                    {chart.aggregation !== "count" && numericColumns.length > 0 && (
                      <label className="space-y-1 sm:col-span-2">
                        <span className="font-medium text-slate-600">Metric Column (Y-Axis)</span>
                        <select
                          value={chart.yColumnKey ?? numericColumns[0]?.key}
                          onChange={(e) => onUpdateChart(chart.id, { yColumnKey: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                        >
                          {numericColumns.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}

                {/* Chart Canvas */}
                <div className="h-72 w-full">
                  {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No matching data for current filters.
                    </div>
                  ) : chart.type === "bar" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={false}
                          interval={0}
                          angle={data.length > 6 ? -20 : 0}
                          textAnchor={data.length > 6 ? "end" : "middle"}
                          height={data.length > 6 ? 50 : 30}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) =>
                            formatAxisValue(Number(v), isCurrency, currencyCode)
                          }
                          width={64}
                        />
                        <Tooltip
                          formatter={(val) => [
                            formatAxisValue(Number(val ?? 0), isCurrency, currencyCode),
                            chart.aggregation === "count" ? "Records" : yCol?.label ?? "Value",
                          ]}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : chart.type === "line" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) =>
                            formatAxisValue(Number(v), isCurrency, currencyCode)
                          }
                          width={64}
                        />
                        <Tooltip
                          formatter={(val) => [
                            formatAxisValue(Number(val ?? 0), isCurrency, currencyCode),
                            chart.aggregation === "count" ? "Records" : yCol?.label ?? "Value",
                          ]}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: "#2563eb" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : chart.type === "area" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                        <defs>
                          <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) =>
                            formatAxisValue(Number(v), isCurrency, currencyCode)
                          }
                          width={64}
                        />
                        <Tooltip
                          formatter={(val) => [
                            formatAxisValue(Number(val ?? 0), isCurrency, currencyCode),
                            chart.aggregation === "count" ? "Records" : yCol?.label ?? "Value",
                          ]}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          fill={`url(#grad-${chart.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={chart.type === "doughnut" ? 56 : 0}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          {data.map((_, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val) => [
                            formatAxisValue(Number(val ?? 0), isCurrency, currencyCode),
                            chart.aggregation === "count" ? "Records" : yCol?.label ?? "Value",
                          ]}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "11px" }}
                          iconType="circle"
                          iconSize={8}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Chart Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Add Visualization</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChart} className="space-y-4 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Chart Title</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Chart Type</span>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ChartType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="area">Area</option>
                    <option value="pie">Pie</option>
                    <option value="doughnut">Doughnut</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Aggregation</span>
                  <select
                    value={newAgg}
                    onChange={(e) => setNewAgg(e.target.value as ChartAggregation)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="count">Count</option>
                    {numericColumns.length > 0 && (
                      <>
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Group By Column</span>
                <select
                  value={newXCol}
                  onChange={(e) => setNewXCol(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {columns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} ({c.type})
                    </option>
                  ))}
                </select>
              </label>

              {newAgg !== "count" && numericColumns.length > 0 && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Metric Column</span>
                  <select
                    value={newYCol}
                    onChange={(e) => setNewYCol(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    {numericColumns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  Add Chart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
