export type ColumnDataType =
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "email"
  | "boolean"
  | "status"
  | "category"
  | "text";

export type SemanticRole =
  | "id"
  | "name"
  | "company"
  | "email"
  | "status"
  | "category"
  | "location"
  | "date"
  | "metric"
  | "general";

export type CurrencyCode = "USD" | "INR" | "EUR" | "GBP" | "JPY";
export type CurrencyPreference = CurrencyCode | "AUTO";
export type DateFormatPreference = "auto" | "MDY" | "DMY";

export interface ColumnProfile {
  /** Unique internal key (safe for duplicate header names) */
  key: string;
  /** Original header name from the spreadsheet */
  label: string;
  /** Column index in the original sheet */
  index: number;
  /** Detected primary data type */
  type: ColumnDataType;
  /** Semantic hint inferred deterministically from header & values */
  role: SemanticRole;
  /** Detected currency code if type === 'currency' */
  currencyCode?: CurrencyCode;
  /** Total non-empty cells */
  nonNullCount: number;
  /** Total empty/blank cells */
  missingCount: number;
  /** Count of distinct non-empty values */
  uniqueCount: number;
  /** Complete distinct values (capped at 5000 for memory safety) */
  uniqueValues: string[];
  /** Sample distinct values (first 12, for quick preview) */
  sampleValues: string[];
  /** Numeric statistics if applicable */
  numericStats?: {
    validCount: number;
    missingCount: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    median: number;
  };
  /** Date range if applicable */
  dateStats?: {
    minIso: string;
    maxIso: string;
    hasAmbiguousDates?: boolean;
  };
  /** Whether mixed types were detected in this column */
  hasMixedTypes: boolean;
}

export type CellValue = string | number | boolean | null;

export type DataRow = Record<string, CellValue>;

export interface ParsedSheet {
  name: string;
  columns: ColumnProfile[];
  rows: DataRow[];
  rowCount: number;
  columnCount: number;
}

export interface ParsedWorkbook {
  fileName: string;
  fileSize: number;
  fileType: "xlsx" | "xls" | "csv" | "sample";
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  warnings: string[];
}

export type SummaryCardFormat = "number" | "currency" | "percentage";
export type SummaryCardAggregation = "count" | "unique" | "sum" | "avg" | "min" | "max" | "non_empty";

export interface SummaryCardConfig {
  id: string;
  title: string;
  subtitle?: string;
  columnKey?: string;
  aggregation: SummaryCardAggregation;
  format: SummaryCardFormat;
  currencyCode?: CurrencyCode;
  accent: "indigo" | "blue" | "violet" | "emerald" | "amber";
}

export type ChartType = "bar" | "line" | "area" | "pie" | "doughnut";
export type ChartAggregation = "count" | "sum" | "avg";

export interface ChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  type: ChartType;
  xColumnKey: string;
  yColumnKey?: string;
  aggregation: ChartAggregation;
  maxItems?: number;
  dateGranularity?: "day" | "month" | "year";
}

export type DashboardSectionId = "summary" | "charts" | "table";

export interface ColumnTableFilter {
  mode: "contains" | "range" | "blank_only" | "non_blank";
  text?: string;
  min?: string;
  max?: string;
}

export interface DashboardFilterState {
  search: string;
  columnFilters: Record<string, string[]>;
  tableColumnFilters?: Record<string, ColumnTableFilter>;
  dateRange?: {
    columnKey: string;
    from?: string;
    to?: string;
  };
}

export interface DashboardConfig {
  title: string;
  activeSheetName: string;
  sectionOrder: DashboardSectionId[];
  summaryCards: SummaryCardConfig[];
  charts: ChartConfig[];
  currencyOverride?: CurrencyPreference;
  dateFormatPreference?: DateFormatPreference;
  defaultSort?: {
    columnKey: string;
    desc: boolean;
  };
}
