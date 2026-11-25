import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CurrencyCode } from "../types/dashboard.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number,
  options?: { decimals?: number; compact?: boolean }
): string {
  if (!Number.isFinite(value)) return "0";
  const decimals = options?.decimals ?? (Number.isInteger(value) ? 0 : 2);
  if (options?.compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
};

export function formatCurrency(
  value: number,
  compact = false,
  currencyCode: CurrencyCode = "USD"
): string {
  if (!Number.isFinite(value)) return formatCurrency(0, false, currencyCode);
  const locale = CURRENCY_LOCALES[currencyCode] ?? "en-US";
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: currencyCode === "JPY" || Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: currencyCode === "JPY" ? 0 : 2,
  }).format(value);
}

export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}
