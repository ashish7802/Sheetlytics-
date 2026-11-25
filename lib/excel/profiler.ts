import type {
  CellValue,
  ColumnDataType,
  ColumnProfile,
  DataRow,
  SemanticRole,
} from "@/types/dashboard";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_REGEX = /^\s*[$€£¥₹]\s*-?[\d,]+(\.\d+)?\s*$|^\s*-?[\d,]+(\.\d+)?\s*[$€£¥₹]\s*$/;
const PERCENT_REGEX = /^\s*-?[\d,]+(\.\d+)?\s*%\s*$/;
const PURE_NUMBER_REGEX = /^\s*-?[\d,]+(\.\d+)?\s*$/;
const ISO_OR_COMMON_DATE_REGEX =
  /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/;

/**
 * Normalizes raw header strings into unique internal keys while preserving
 * the original display label.
 */
export function buildColumnKeys(rawHeaders: string[]): Array<{ key: string; label: string }> {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw, idx) => {
    const label = raw.trim() || `Column ${idx + 1}`;
    const base = label;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const key = count === 0 ? base : `${base} (${count + 1})`;
    return { key, label };
  });
}

export function tryParseNumber(val: CellValue): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (
    PURE_NUMBER_REGEX.test(trimmed) ||
    CURRENCY_REGEX.test(trimmed) ||
    PERCENT_REGEX.test(trimmed)
  ) {
    const cleaned = trimmed.replace(/[$€£¥₹%,\s]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function tryParseDateIso(val: CellValue | Date): string | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || PURE_NUMBER_REGEX.test(trimmed)) return null;
  if (!ISO_OR_COMMON_DATE_REGEX.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2100) return null;
  return d.toISOString().slice(0, 10);
}

function inferSemanticRole(label: string, type: ColumnDataType, uniqueRatio: number): SemanticRole {
  const lower = label.toLowerCase();

  if (type === "email" || /\b(e-?mail|mail)\b/.test(lower)) return "email";
  if (/\b(status|stage|state|phase|priority|tier)\b/.test(lower)) return "status";
  if (/\b(date|created|updated|time|month|year|day|timestamp|joined)\b/.test(lower) || type === "date") {
    return "date";
  }
  if (/\b(company|organization|org|account|client|vendor|supplier|brand)\b/.test(lower)) {
    return "company";
  }
  if (/\b(country|city|state|region|location|address|territory|market|warehouse)\b/.test(lower)) {
    return "location";
  }
  if (/\b(category|type|segment|department|industry|group|channel|plan)\b/.test(lower)) {
    return "category";
  }
  if (/\b(id|sku|code|uuid|key|ref)\b/.test(lower) && uniqueRatio > 0.7) {
    return "id";
  }
  if (
    type === "currency" ||
    type === "number" ||
    type === "percentage" ||
    /\b(revenue|amount|price|cost|total|value|profit|salary|qty|quantity|stock|score|units|budget)\b/.test(
      lower
    )
  ) {
    return "metric";
  }
  if (/\b(name|person|contact|lead|employee|student|customer|product|title)\b/.test(lower)) {
    return "name";
  }
  return "general";
}

function calculateMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Deterministically profiles every column in a parsed sheet.
 */
export function profileColumns(
  columnDefs: Array<{ key: string; label: string }>,
  rows: DataRow[]
): ColumnProfile[] {
  return columnDefs.map((col, index) => {
    let nonNullCount = 0;
    let missingCount = 0;
    let emailHits = 0;
    let currencyHits = 0;
    let percentHits = 0;
    let numberHits = 0;
    let dateHits = 0;
    let boolHits = 0;
    let textHits = 0;

    const distinctValues = new Set<string>();
    const numericValues: number[] = [];
    const dateValues: string[] = [];

    for (const row of rows) {
      const raw = row[col.key];
      if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
        missingCount++;
        continue;
      }

      nonNullCount++;
      const str = String(raw).trim();
      if (distinctValues.size < 5000) {
        distinctValues.add(str);
      }

      if (typeof raw === "boolean" || /^(true|false|yes|no)$/i.test(str)) {
        boolHits++;
        continue;
      }

      if (EMAIL_REGEX.test(str)) {
        emailHits++;
        continue;
      }

      if (CURRENCY_REGEX.test(str)) {
        currencyHits++;
        const n = tryParseNumber(raw);
        if (n !== null) numericValues.push(n);
        continue;
      }

      if (PERCENT_REGEX.test(str)) {
        percentHits++;
        const n = tryParseNumber(raw);
        if (n !== null) numericValues.push(n);
        continue;
      }

      if (typeof raw === "number" || PURE_NUMBER_REGEX.test(str)) {
        const n = tryParseNumber(raw);
        if (n !== null) {
          numberHits++;
          numericValues.push(n);
          continue;
        }
      }

      const iso = tryParseDateIso(raw);
      if (iso) {
        dateHits++;
        dateValues.push(iso);
        continue;
      }

      textHits++;
    }

    const total = Math.max(nonNullCount, 1);
    const threshold = 0.75;
    let type: ColumnDataType = "text";

    const labelLower = col.label.toLowerCase();
    const looksLikeCurrencyHeader = /\b(revenue|price|cost|amount|value|budget|salary|profit|sales|deal)\b/.test(
      labelLower
    );
    const looksLikePercentHeader = /\b(rate|pct|percent|margin|ratio|conversion|discount)\b/.test(
      labelLower
    );

    if (emailHits / total >= threshold) {
      type = "email";
    } else if (currencyHits / total >= threshold) {
      type = "currency";
    } else if (percentHits / total >= threshold) {
      type = "percentage";
    } else if ((numberHits + currencyHits + percentHits) / total >= threshold) {
      if (looksLikeCurrencyHeader && currencyHits >= 0) {
        type = "currency";
      } else if (looksLikePercentHeader && percentHits >= 0) {
        type = "percentage";
      } else {
        type = "number";
      }
    } else if (dateHits / total >= threshold) {
      type = "date";
    } else if (boolHits / total >= threshold) {
      type = "boolean";
    } else {
      const uniqueRatio = distinctValues.size / total;
      if (/\b(status|stage|state|priority|tier)\b/.test(labelLower) && distinctValues.size <= 25) {
        type = "status";
      } else if (distinctValues.size >= 2 && distinctValues.size <= 30 && (uniqueRatio <= 0.5 || nonNullCount >= 5)) {
        type = "category";
      } else {
        type = "text";
      }
    }

    // Detect mixed types (more than one non-trivial type bucket)
    const activeBuckets = [
      emailHits > 0,
      currencyHits + numberHits + percentHits > 0,
      dateHits > 0,
      boolHits > 0,
      textHits > 0,
    ].filter(Boolean).length;
    const hasMixedTypes = activeBuckets > 1 && nonNullCount > 0;

    let numericStats: ColumnProfile["numericStats"];
    if (
      (type === "number" || type === "currency" || type === "percentage") &&
      numericValues.length > 0
    ) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const sum = numericValues.reduce((acc, v) => acc + v, 0);
      numericStats = {
        sum,
        avg: sum / numericValues.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: calculateMedian(sorted),
      };
    }

    let dateStats: ColumnProfile["dateStats"];
    if (type === "date" && dateValues.length > 0) {
      const sortedDates = [...dateValues].sort();
      dateStats = {
        minIso: sortedDates[0],
        maxIso: sortedDates[sortedDates.length - 1],
      };
    }

    const uniqueRatio = nonNullCount > 0 ? distinctValues.size / nonNullCount : 0;
    const role = inferSemanticRole(col.label, type, uniqueRatio);

    return {
      key: col.key,
      label: col.label,
      index,
      type,
      role,
      nonNullCount,
      missingCount,
      uniqueCount: distinctValues.size,
      sampleValues: Array.from(distinctValues).slice(0, 12),
      numericStats,
      dateStats,
      hasMixedTypes,
    };
  });
}
