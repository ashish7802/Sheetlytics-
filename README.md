# Sheetlytics

**Sheetlytics** is a **chart-free**, privacy-first Excel and CSV to Dashboard web application built with Next.js (App Router), TypeScript, Tailwind CSS, SheetJS (`xlsx`), TanStack Table v8, Zod, and jsPDF.

It transforms uploaded `.xlsx`, `.xls`, and `.csv` files into a clean SaaS dashboard featuring **deterministic summary cards** and a **mandatory, complete interactive data table**—with **zero AI/LLM integrations** and **zero charts**.

## Core Principles

- **Chart-Free by Design**: Sheetlytics never generates or renders charts (no bar, line, area, pie, or doughnut charts). The focus remains strictly on accurate summary metrics and the complete spreadsheet data table.
- **Always-Present Data Table**: Every valid uploaded worksheet always produces its complete data table, preserving all columns, rows, original row order, and cell values—even for text-only or single-column datasets.
- **100% Deterministic & Client-Side**: All parsing, column profiling, filtering, and KPI calculations run locally in your browser (using a Web Worker with timeout and fallback). Uploaded files are never sent to an external server.

## Key Features

- **Excel & CSV Upload**: Drag-and-drop or browse `.xlsx`, `.xls`, and `.csv` files (up to 50 MB), with multi-worksheet selection and built-in sample datasets.
- **Deterministic Column Profiling**: Detects numbers, currencies (`USD`, `INR`, `EUR`, `GBP`, `JPY`), percentages, dates (ISO, Excel serials, `MDY`/`DMY` with ambiguity notice), emails, statuses, and categories.
- **Customizable Summary Cards**: Auto-generates relevant KPIs (total records, unique counts, populated email counts, sums, averages) and lets users rename, add, or remove cards.
- **Complete Data Explorer Table**: Global search, searchable multi-select category filters (including `(Blank)`), per-column text/numeric-range/blank filters, multi-type sorting, pagination, column resizing, sticky headers, and column visibility toggles.
- **Local Persistence**: Saves dashboard configurations and display preferences locally in browser IndexedDB (with `localStorage` fallback).
- **Exports**: Download original file, filtered CSV, multi-sheet Excel (`.xlsx`), chart-free PDF report, or print-friendly layout.

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing & Verification

```bash
# Unit & performance tests (5k, 10k, 50k rows)
node --test tests/engine.test.ts

# Linter & production build
npm run lint
npm run build

# Browser end-to-end tests (requires running dev server on port 3000)
node tests/e2e.mjs
```
