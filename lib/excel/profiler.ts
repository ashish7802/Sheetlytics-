import type {
  CellValue,
  ColumnDataType,
  ColumnProfile,
  CurrencyCode,
  DataRow,
  DateFormatPreference,
  SemanticRole,
} from "../../types/dashboard.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_REGEX = /^\s*[$€£¥₹]\s*-?[\d,]+(\.\d+)?\s*$|^\s*-?[\d,]+(\.\d+)?\s*[$€£¥₹]\s*$/;
const PERCENT_REGEX = /^\s*-?[\d,]+(\.\d+)?\s*%\s*$/;
const PURE_NUMBER_REGEX = /^\s*-?[\d,]+(\.\d+)?\s*$/;

const ISO_DATE_REGEX = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?.*)?$/;
const SLASH_DATE_REGEX = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const MONTH_NAME_DATE_REGEX = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$|^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/;

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

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

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null;
  // Excel epoch: 1899-12-30 (accounting for Excel's 1900 leap-year bug)
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return d.toISOString().slice(0, 10);
}

export interface DateParseDetail {
  iso: string;
  ambiguous: boolean;
}

/**
 * Deterministic, locale-independent date parser.
 * Does not rely on browser-dependent Date.parse() for slash/dash numeric dates.
 */
export function parseDateDeterministic(
  val: CellValue | Date,
  preference: DateFormatPreference = "auto",
  allowExcelSerial = false
): DateParseDetail | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    if (y >= 1900 && y <= 2100) {
      return { iso: val.toISOString().slice(0, 10), ambiguous: false };
    }
    return null;
  }

  if (typeof val === "number") {
    if (!allowExcelSerial) return null;
    const iso = excelSerialToIso(val);
    return iso ? { iso, ambiguous: false } : null;
  }

  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || PURE_NUMBER_REGEX.test(trimmed)) return null;

  // 1. ISO YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = ISO_DATE_REGEX.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidCalendarDate(year, month, day)) {
      return { iso: toIsoDate(year, month, day), ambiguous: false };
    }
    return null;
  }

  // 2. Named month formats: "Jan 15, 2026" or "15 Jan 2026"
  const nameMatch = MONTH_NAME_DATE_REGEX.exec(trimmed);
  if (nameMatch) {
    const monthStr = (nameMatch[1] ?? nameMatch[5] ?? "").toLowerCase();
    const day = Number(nameMatch[2] ?? nameMatch[4]);
    const year = Number(nameMatch[3] ?? nameMatch[6]);
    const month = MONTH_MAP[monthStr];
    if (month && isValidCalendarDate(year, month, day)) {
      return { iso: toIsoDate(year, month, day), ambiguous: false };
    }
    return null;
  }

  // 3. Slash/dash numeric: AA/BB/YYYY or AA-BB-YYYY
  const slashMatch = SLASH_DATE_REGEX.exec(trimmed);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    if (a > 12 && b <= 12) {
      // Unambiguously DD/MM/YYYY
      return isValidCalendarDate(year, b, a)
        ? { iso: toIsoDate(year, b, a), ambiguous: false }
        : null;
    }
    if (b > 12 && a <= 12) {
      // Unambiguously MM/DD/YYYY
      return isValidCalendarDate(year, a, b)
        ? { iso: toIsoDate(year, a, b), ambiguous: false }
        : null;
    }
    if (a <= 12 && b <= 12) {
      const ambiguous = a !== b;
      const useDmy = preference === "DMY";
      const month = useDmy ? b : a;
      const day = useDmy ? a : b;
      return isValidCalendarDate(year, month, day)
        ? { iso: toIsoDate(year, month, day), ambiguous }
        : null;
    }
  }

  return null;
}

export function tryParseDateIso(
  val: CellValue | Date,
  preference: DateFormatPreference = "auto",
  allowExcelSerial = false
): string | null {
  return parseDateDeterministic(val, preference, allowExcelSerial)?.iso ?? null;
}

function detectCurrencyCode(label: string, symbolCounts: Record<CurrencyCode, number>): CurrencyCode {
  let topCode: CurrencyCode | null = null;
  let topCount = 0;
  for (const [code, count] of Object.entries(symbolCounts) as Array<[CurrencyCode, number]>) {
    if (count > topCount) {
      topCount = count;
      topCode = code;
    }
  }
  if (topCode) return topCode;

  const lower = label.toLowerCase();
  if (/\b(inr|rs|rupee|rupees)\b/.test(lower)) return "INR";
  if (/\b(eur|euro|euros)\b/.test(lower)) return "EUR";
  if (/\b(gbp|pound|pounds)\b/.test(lower)) return "GBP";
  if (/\b(jpy|yen)\b/.test(lower)) return "JPY";
  return "USD";
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
  rows: DataRow[],
  datePreference: DateFormatPreference = "auto"
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
    let hasAmbiguousDates = false;

    const currencySymbolCounts: Record<CurrencyCode, number> = {
      USD: 0,
      INR: 0,
      EUR: 0,
      GBP: 0,
      JPY: 0,
    };

    const distinctValues = new Set<string>();
    const numericValues: number[] = [];
    const dateValues: string[] = [];

    const labelLower = col.label.toLowerCase();
    const allowExcelSerialDate = /\b(date|created|updated|joined|dob|timestamp)\b/.test(labelLower);

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
        if (str.includes("₹")) currencySymbolCounts.INR++;
        else if (str.includes("€")) currencySymbolCounts.EUR++;
        else if (str.includes("£")) currencySymbolCounts.GBP++;
        else if (str.includes("¥")) currencySymbolCounts.JPY++;
        else if (str.includes("$")) currencySymbolCounts.USD++;
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
        if (typeof raw === "number" && allowExcelSerialDate && raw >= 25569 && raw <= 73050) {
          const serialIso = excelSerialToIso(raw);
          if (serialIso) {
            dateHits++;
            dateValues.push(serialIso);
            continue;
          }
        }
        const n = tryParseNumber(raw);
        if (n !== null) {
          numberHits++;
          numericValues.push(n);
          continue;
        }
      }

      const dateDetail = parseDateDeterministic(raw, datePreference, allowExcelSerialDate);
      if (dateDetail) {
        dateHits++;
        if (dateDetail.ambiguous) hasAmbiguousDates = true;
        dateValues.push(dateDetail.iso);
        continue;
      }

      textHits++;
    }

    const total = Math.max(nonNullCount, 1);
    const threshold = 0.75;
    let type: ColumnDataType = "text";

    const looksLikeCurrencyHeader = /\b(revenue|price|cost|amount|value|budget|salary|profit|sales|deal|inr|usd|eur|gbp)\b/.test(
      labelLower
    );
    const looksLikePercentHeader = /\b(rate|pct|percent|margin|ratio|conversion|discount|attendance)\b/.test(
      labelLower
    );

    if (emailHits / total >= threshold) {
      type = "email";
    } else if (currencyHits / total >= threshold) {
      type = "currency";
    } else if (percentHits / total >= threshold) {
      type = "percentage";
    } else if ((numberHits + currencyHits + percentHits) / total >= threshold) {
      if (looksLikeCurrencyHeader) {
        type = "currency";
      } else if (looksLikePercentHeader) {
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
      if (/\b(status|stage|state|priority|tier)\b/.test(labelLower) && distinctValues.size <= 30) {
        type = "status";
      } else if (
        distinctValues.size >= 2 &&
        distinctValues.size <= 50 &&
        (uniqueRatio <= 0.5 || nonNullCount >= 5)
      ) {
        type = "category";
      } else {
        type = "text";
      }
    }

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
        validCount: numericValues.length,
        missingCount: rows.length - numericValues.length,
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
        hasAmbiguousDates,
      };
    }

    const uniqueRatio = nonNullCount > 0 ? distinctValues.size / nonNullCount : 0;
    const role = inferSemanticRole(col.label, type, uniqueRatio);
    const uniqueValues = Array.from(distinctValues).sort((a, b) => a.localeCompare(b));

    return {
      key: col.key,
      label: col.label,
      index,
      type,
      role,
      currencyCode: type === "currency" ? detectCurrencyCode(col.label, currencySymbolCounts) : undefined,
      nonNullCount,
      missingCount,
      uniqueCount: distinctValues.size,
      uniqueValues,
      sampleValues: uniqueValues.slice(0, 12),
      numericStats,
      dateStats,
      hasMixedTypes,
    };
  });
}
