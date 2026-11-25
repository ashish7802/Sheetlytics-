import { tryParseDateIso, tryParseNumber } from "../excel/profiler.ts";
import { formatCurrency, formatNumber, formatPercentage } from "../utils.ts";
import type {
  ChartConfig,
  ColumnProfile,
  CurrencyPreference,
  DashboardConfig,
  DashboardFilterState,
  DashboardSectionId,
  DataRow,
  DateFormatPreference,
  ParsedSheet,
  SummaryCardConfig,
} from "../../types/dashboard.ts";

const ACCENTS: SummaryCardConfig["accent"][] = [
  "indigo",
  "blue",
  "violet",
  "emerald",
  "amber",
];

function formatTitleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.(xlsx|xls|csv)$/i, "");
  const cleaned = withoutExt.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return "Spreadsheet Dashboard";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Guarantees that the mandatory Data Table section is always present in sectionOrder.
 */
export function ensureTableSection(order: DashboardSectionId[]): DashboardSectionId[] {
  const unique = Array.from(new Set(order));
  if (!unique.includes("table")) {
    unique.push("table");
  }
  return unique;
}

/**
 * Deterministically generates summary cards, charts, and default layout
 * from a profiled spreadsheet without any AI.
 */
export function generateDashboardConfig(
  sheet: ParsedSheet,
  fileName: string
): DashboardConfig {
  const cols = sheet.columns;
  const summaryCards: SummaryCardConfig[] = [];
  const charts: ChartConfig[] = [];

  // 1. Primary Total Records card
  summaryCards.push({
    id: "card-total-rows",
    title: "Total Records",
    subtitle: `Rows in ${sheet.name}`,
    aggregation: "count",
    format: "number",
    accent: "indigo",
  });

  // 2. Look for company / entity / location unique count
  const entityCol =
    cols.find((c) => c.role === "company" && c.uniqueCount > 1) ??
    cols.find((c) => c.role === "category" && c.uniqueCount > 1 && c.uniqueCount < sheet.rowCount);

  if (entityCol) {
    summaryCards.push({
      id: `card-unique-${entityCol.key}`,
      title: `Unique ${entityCol.label}`,
      subtitle: "Distinct values",
      columnKey: entityCol.key,
      aggregation: "unique",
      format: "number",
      accent: "blue",
    });
  }

  // 3. Look for email column -> populated/present emails (never claim verified without evidence)
  const emailCol = cols.find((c) => c.role === "email" || c.type === "email");
  if (emailCol) {
    summaryCards.push({
      id: `card-emails-${emailCol.key}`,
      title: `Populated ${emailCol.label}s`,
      subtitle: `${emailCol.missingCount} missing`,
      columnKey: emailCol.key,
      aggregation: "non_empty",
      format: "number",
      accent: "emerald",
    });
  }

  // 4. Primary numeric / currency columns -> sum and/or avg
  const numericCols = cols.filter(
    (c) => (c.type === "currency" || c.type === "number" || c.type === "percentage") && c.role !== "id"
  );

  for (const numCol of numericCols.slice(0, 2)) {
    if (summaryCards.length >= 4) break;
    const isPercent = numCol.type === "percentage";
    const isCurrency = numCol.type === "currency";
    const currCode = numCol.currencyCode ?? "USD";
    const avgVal = numCol.numericStats?.avg ?? 0;

    summaryCards.push({
      id: `card-metric-${numCol.key}`,
      title: isPercent ? `Avg ${numCol.label}` : `Total ${numCol.label}`,
      subtitle: isPercent
        ? `${numCol.numericStats?.validCount ?? 0} valid values`
        : `Avg ${isCurrency ? formatCurrency(avgVal, false, currCode) : formatNumber(avgVal)}`,
      columnKey: numCol.key,
      aggregation: isPercent ? "avg" : "sum",
      format: isCurrency ? "currency" : isPercent ? "percentage" : "number",
      currencyCode: isCurrency ? currCode : undefined,
      accent: ACCENTS[summaryCards.length % ACCENTS.length],
    });
  }

  // Fill up to 4 cards if needed using status
  if (summaryCards.length < 4) {
    const statusCol = cols.find((c) => c.role === "status" || c.type === "status");
    if (statusCol) {
      summaryCards.push({
        id: `card-status-groups-${statusCol.key}`,
        title: `${statusCol.label} Groups`,
        subtitle: "Distinct statuses",
        columnKey: statusCol.key,
        aggregation: "unique",
        format: "number",
        accent: ACCENTS[summaryCards.length % ACCENTS.length],
      });
    }
  }

  // --- Chart Generation Rules ---
  const dateCol = cols.find((c) => c.type === "date" && c.nonNullCount >= 2);
  const primaryMetric = numericCols.find((c) => c.type === "currency") ?? numericCols[0];
  const secondaryMetric = numericCols.length > 1 ? numericCols[1] : undefined;

  const categoricalCols = cols.filter(
    (c) =>
      (c.type === "category" || c.type === "status" || c.role === "location" || c.role === "category") &&
      c.uniqueCount >= 2 &&
      c.uniqueCount <= 50 &&
      c.role !== "id" &&
      c.role !== "email"
  );

  // Rule 1: Date + Numeric -> Area/Line Trend Chart
  if (dateCol && primaryMetric) {
    charts.push({
      id: `chart-trend-${dateCol.key}`,
      title: `${primaryMetric.label} Over Time`,
      subtitle: `Grouped by ${dateCol.label}`,
      type: "area",
      xColumnKey: dateCol.key,
      yColumnKey: primaryMetric.key,
      aggregation: "sum",
      dateGranularity: "month",
      maxItems: 24,
    });
  } else if (dateCol) {
    charts.push({
      id: `chart-trend-count-${dateCol.key}`,
      title: `Records Over Time`,
      subtitle: `Count by ${dateCol.label}`,
      type: "line",
      xColumnKey: dateCol.key,
      aggregation: "count",
      dateGranularity: "month",
      maxItems: 24,
    });
  }

  // Rule 2: Status distribution -> Doughnut Chart
  const statusCol = categoricalCols.find((c) => c.role === "status" || c.type === "status");
  if (statusCol) {
    charts.push({
      id: `chart-status-${statusCol.key}`,
      title: `${statusCol.label} Distribution`,
      subtitle: "Breakdown by count",
      type: "doughnut",
      xColumnKey: statusCol.key,
      aggregation: "count",
      maxItems: 8,
    });
  }

  // Rule 3: Category / Location + Primary Metric -> Bar Chart
  const mainCategory = categoricalCols.find((c) => c.key !== statusCol?.key) ?? categoricalCols[0];
  if (mainCategory && primaryMetric) {
    charts.push({
      id: `chart-cat-metric-${mainCategory.key}`,
      title: `${primaryMetric.label} by ${mainCategory.label}`,
      subtitle: `Total ${primaryMetric.label}`,
      type: "bar",
      xColumnKey: mainCategory.key,
      yColumnKey: primaryMetric.key,
      aggregation: "sum",
      maxItems: 10,
    });
  } else if (mainCategory) {
    charts.push({
      id: `chart-cat-count-${mainCategory.key}`,
      title: `Count by ${mainCategory.label}`,
      subtitle: "Top categories",
      type: "bar",
      xColumnKey: mainCategory.key,
      aggregation: "count",
      maxItems: 10,
    });
  }

  // Rule 4: Additional categorical comparison if space (< 4 charts)
  const extraCat = categoricalCols.find(
    (c) => c.key !== statusCol?.key && c.key !== mainCategory?.key
  );
  if (extraCat && charts.length < 4) {
    charts.push({
      id: `chart-extra-${extraCat.key}`,
      title: secondaryMetric
        ? `${secondaryMetric.label} by ${extraCat.label}`
        : `${extraCat.label} Breakdown`,
      subtitle: secondaryMetric ? `Sum of ${secondaryMetric.label}` : "Record count",
      type: "bar",
      xColumnKey: extraCat.key,
      yColumnKey: secondaryMetric?.key,
      aggregation: secondaryMetric ? "sum" : "count",
      maxItems: 10,
    });
  }

  // Fallback: if no date or category columns exist, create a chart only if numeric metric exists
  if (charts.length === 0 && primaryMetric) {
    charts.push({
      id: `chart-dist-${primaryMetric.key}`,
      title: `${primaryMetric.label} Overview`,
      subtitle: "Distribution across values",
      type: "bar",
      xColumnKey: primaryMetric.key,
      aggregation: "count",
      maxItems: 10,
    });
  }

  return {
    title: formatTitleFromFileName(fileName),
    activeSheetName: sheet.name,
    sectionOrder: ["summary", "charts", "table"],
    summaryCards,
    charts,
    currencyOverride: "AUTO",
    dateFormatPreference: "auto",
  };
}

/**
 * Filters rows deterministically based on global search, category multi-selects,
 * per-column table filters, and date range.
 */
export function applyDashboardFilters(
  sheet: ParsedSheet,
  filters: DashboardFilterState,
  datePreference: DateFormatPreference = "auto"
): DataRow[] {
  const searchLower = filters.search.trim().toLowerCase();
  const activeColFilters = Object.entries(filters.columnFilters).filter(
    ([, values]) => values.length > 0
  );
  const activeTableFilters = Object.entries(filters.tableColumnFilters ?? {}).filter(
    ([, f]) =>
      f.mode === "blank_only" ||
      f.mode === "non_blank" ||
      (f.mode === "contains" && Boolean(f.text?.trim())) ||
      (f.mode === "range" && (Boolean(f.min?.trim()) || Boolean(f.max?.trim())))
  );
  const dateRange = filters.dateRange;

  if (
    !searchLower &&
    activeColFilters.length === 0 &&
    activeTableFilters.length === 0 &&
    !dateRange?.from &&
    !dateRange?.to
  ) {
    return sheet.rows;
  }

  return sheet.rows.filter((row) => {
    // 1. Global search across all columns
    if (searchLower) {
      let matched = false;
      for (const col of sheet.columns) {
        const val = row[col.key];
        if (val !== null && val !== undefined && String(val).toLowerCase().includes(searchLower)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }

    // 2. Column-specific multi-select filters (including "(Blank)")
    for (const [colKey, allowedValues] of activeColFilters) {
      const val = row[colKey];
      const strVal =
        val === null || val === undefined || String(val).trim() === ""
          ? "(Blank)"
          : String(val).trim();
      if (!allowedValues.includes(strVal)) {
        return false;
      }
    }

    // 3. Per-column table filters (text contains, numeric range, blank/non-blank)
    for (const [colKey, tf] of activeTableFilters) {
      const val = row[colKey];
      const isBlank = val === null || val === undefined || String(val).trim() === "";

      if (tf.mode === "blank_only") {
        if (!isBlank) return false;
      } else if (tf.mode === "non_blank") {
        if (isBlank) return false;
      } else if (tf.mode === "contains" && tf.text?.trim()) {
        if (isBlank || !String(val).toLowerCase().includes(tf.text.trim().toLowerCase())) {
          return false;
        }
      } else if (tf.mode === "range") {
        const num = tryParseNumber(val);
        if (num === null) return false;
        if (tf.min?.trim() && num < Number(tf.min)) return false;
        if (tf.max?.trim() && num > Number(tf.max)) return false;
      }
    }

    // 4. Date range filter
    if (dateRange && (dateRange.from || dateRange.to)) {
      const col = sheet.columns.find((c) => c.key === dateRange.columnKey);
      const allowSerial = col
        ? /\b(date|created|updated|joined|dob|timestamp)\b/.test(col.label.toLowerCase())
        : false;
      const iso = tryParseDateIso(row[dateRange.columnKey], datePreference, allowSerial);
      if (!iso) return false;
      if (dateRange.from && iso < dateRange.from) return false;
      if (dateRange.to && iso > dateRange.to) return false;
    }

    return true;
  });
}

export interface SummaryCardResult {
  value: number;
  formatted: string;
  validCount: number;
  missingCount: number;
}

export function computeSummaryCardValue(
  rows: DataRow[],
  card: SummaryCardConfig,
  currencyOverride: CurrencyPreference = "AUTO"
): SummaryCardResult {
  let value = 0;
  let validCount = rows.length;
  let missingCount = 0;

  if (card.aggregation === "count") {
    value = rows.length;
  } else if (card.columnKey) {
    const key = card.columnKey;
    if (card.aggregation === "unique") {
      const set = new Set<string>();
      let nonEmpty = 0;
      for (const r of rows) {
        const v = r[key];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          nonEmpty++;
          set.add(String(v).trim());
        }
      }
      value = set.size;
      validCount = nonEmpty;
      missingCount = rows.length - nonEmpty;
    } else if (card.aggregation === "non_empty") {
      let count = 0;
      for (const r of rows) {
        const v = r[key];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          count++;
        }
      }
      value = count;
      validCount = count;
      missingCount = rows.length - count;
    } else {
      const nums: number[] = [];
      for (const r of rows) {
        const n = tryParseNumber(r[key]);
        if (n !== null) nums.push(n);
      }
      validCount = nums.length;
      missingCount = rows.length - nums.length;
      if (nums.length > 0) {
        if (card.aggregation === "sum") {
          value = nums.reduce((a, b) => a + b, 0);
        } else if (card.aggregation === "avg") {
          value = nums.reduce((a, b) => a + b, 0) / nums.length;
        } else if (card.aggregation === "min") {
          value = Math.min(...nums);
        } else if (card.aggregation === "max") {
          value = Math.max(...nums);
        }
      }
    }
  }

  let formatted = formatNumber(value, { compact: value >= 100000 });
  if (card.format === "currency") {
    const code = currencyOverride !== "AUTO" ? currencyOverride : (card.currencyCode ?? "USD");
    formatted = formatCurrency(value, value >= 100000, code);
  } else if (card.format === "percentage") {
    formatted = formatPercentage(value);
  }

  return { value, formatted, validCount, missingCount };
}

export interface ChartDataPoint {
  name: string;
  value: number;
  count: number;
  validNumericCount: number;
}

export function computeChartData(
  rows: DataRow[],
  chart: ChartConfig,
  columns: ColumnProfile[],
  datePreference: DateFormatPreference = "auto"
): ChartDataPoint[] {
  const xCol = columns.find((c) => c.key === chart.xColumnKey);
  if (!xCol) return [];

  const buckets = new Map<
    string,
    { sum: number; count: number; validNumericCount: number }
  >();

  const isDateAxis = xCol.type === "date";
  const allowSerial = /\b(date|created|updated|joined|dob|timestamp)\b/.test(
    xCol.label.toLowerCase()
  );
  const granularity = chart.dateGranularity ?? "month";

  for (const row of rows) {
    const rawX = row[chart.xColumnKey];
    let bucketKey = "(Blank)";

    if (rawX !== null && rawX !== undefined && String(rawX).trim() !== "") {
      if (isDateAxis) {
        const iso = tryParseDateIso(rawX, datePreference, allowSerial);
        if (!iso) continue;
        if (granularity === "year") {
          bucketKey = iso.slice(0, 4);
        } else if (granularity === "month") {
          bucketKey = iso.slice(0, 7);
        } else {
          bucketKey = iso;
        }
      } else {
        bucketKey = String(rawX).trim();
      }
    }

    const existing = buckets.get(bucketKey) ?? {
      sum: 0,
      count: 0,
      validNumericCount: 0,
    };
    existing.count += 1;

    if (chart.aggregation !== "count" && chart.yColumnKey) {
      const yNum = tryParseNumber(row[chart.yColumnKey]);
      if (yNum !== null) {
        existing.sum += yNum;
        existing.validNumericCount += 1;
      }
    }

    buckets.set(bucketKey, existing);
  }

  let points: ChartDataPoint[] = Array.from(buckets.entries()).map(([name, agg]) => {
    let value = agg.count;
    if (chart.aggregation === "sum" && chart.yColumnKey) {
      value = Number(agg.sum.toFixed(2));
    } else if (chart.aggregation === "avg" && chart.yColumnKey) {
      // Correctly divide by validNumericCount, NOT total row count
      value =
        agg.validNumericCount > 0
          ? Number((agg.sum / agg.validNumericCount).toFixed(2))
          : 0;
    }
    return {
      name,
      value,
      count: agg.count,
      validNumericCount: agg.validNumericCount,
    };
  });

  if (isDateAxis) {
    points.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    points.sort((a, b) => b.value - a.value);
  }

  const maxItems = chart.maxItems ?? 10;
  if (!isDateAxis && points.length > maxItems) {
    const top = points.slice(0, maxItems - 1);
    const rest = points.slice(maxItems - 1);
    const restSum = rest.reduce((acc, p) => acc + p.value * (chart.aggregation === "avg" ? p.validNumericCount : 1), 0);
    const restCount = rest.reduce((acc, p) => acc + p.count, 0);
    const restValidNumeric = rest.reduce((acc, p) => acc + p.validNumericCount, 0);
    points = [
      ...top,
      {
        name: "Other",
        value:
          chart.aggregation === "avg"
            ? restValidNumeric > 0
              ? Number((restSum / restValidNumeric).toFixed(2))
              : 0
            : Number(restSum.toFixed(2)),
        count: restCount,
        validNumericCount: restValidNumeric,
      },
    ];
  }

  return points;
}
