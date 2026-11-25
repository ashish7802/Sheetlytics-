import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as XLSX from "xlsx";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sheetlytics-e2e-"));

  // 1. Create a real multi-worksheet .xlsx file
  const wb = XLSX.utils.book_new();
  const salesSheet = XLSX.utils.aoa_to_sheet([
    ["Client", "Category", "Region", "Revenue", "Status", "Order Date"],
    ["Acme Corp", "Enterprise", "North", "₹120000", "Won", "2026-01-10"],
    ["Beta LLC", "SaaS", "South", "₹45000", "Qualified", "2026-02-14"],
    ["Gamma Inc", "Enterprise", "East", "₹80000", "Won", "2026-03-20"],
    ["Delta Co", "Retail", "West", "₹30000", "Lost", "2026-04-05"],
  ]);
  const textOnlySheet = XLSX.utils.aoa_to_sheet([
    ["Note Title", "Author", "Comments"],
    ["Kickoff", "Alice", "Initial project scope"],
    ["Review", "Bob", "Approved design tokens"],
  ]);
  XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");
  XLSX.utils.book_append_sheet(wb, textOnlySheet, "TextNotes");
  const xlsxPath = path.join(tmpDir, "multi-sheet-test.xlsx");
  XLSX.writeFile(wb, xlsxPath);

  // 2. Create a 1-column CSV file
  const csvPath = path.join(tmpDir, "one-column.csv");
  fs.writeFileSync(csvPath, "ItemName\nAlpha\nBeta\nGamma\n", "utf-8");

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    console.log("1. Opening app at", BASE_URL);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Upload multi-worksheet Excel file
    console.log("2. Uploading multi-worksheet Excel file...");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(xlsxPath);

    // Wait for mandatory data table
    const table = page.getByTestId("mandatory-data-table");
    await table.waitFor({ state: "visible", timeout: 15000 });
    const rowCountText = await page.getByTestId("table-row-count").textContent();
    assert.ok(rowCountText?.includes("4"), `Expected 4 rows, got: ${rowCountText}`);
    console.log("   ✓ Dashboard & mandatory table rendered:", rowCountText?.trim());

    // Switch to TextNotes worksheet (no numeric columns!)
    console.log("3. Switching to TextNotes worksheet...");
    await page.getByLabel("Select worksheet").selectOption("TextNotes");
    await page.waitForTimeout(300);
    await table.waitFor({ state: "visible" });
    const textSheetCount = await page.getByTestId("table-row-count").textContent();
    assert.ok(textSheetCount?.includes("2"), `Expected 2 rows in TextNotes, got: ${textSheetCount}`);
    console.log("   ✓ Text-only worksheet rendered mandatory table:", textSheetCount?.trim());

    // Switch back to Sales
    await page.getByLabel("Select worksheet").selectOption("Sales");
    await page.waitForTimeout(300);

    // Apply search filter & verify filtered row count
    console.log("4. Applying search filter...");
    const searchInput = page.getByLabel("Search all columns");
    await searchInput.fill("Acme");
    await page.waitForTimeout(250);
    const filteredText = await page.getByTestId("table-row-count").textContent();
    assert.ok(filteredText?.includes("1") && filteredText?.includes("4"), `Expected 1 of 4, got: ${filteredText}`);
    console.log("   ✓ Filtered row count updated:", filteredText?.trim());

    // Clear search
    await page.getByLabel("Clear search").click();
    await page.waitForTimeout(200);

    // Remove all charts and verify table remains visible
    console.log("5. Removing all charts...");
    while ((await page.getByLabel("Remove chart").count()) > 0) {
      await page.getByLabel("Remove chart").first().click();
      await page.waitForTimeout(100);
    }
    assert.equal(await table.isVisible(), true, "Mandatory table must stay visible after removing all charts");
    console.log("   ✓ Mandatory table remained visible with 0 charts");

    // Test browser-local persistence across reload
    console.log("6. Testing refresh & local persistence...");
    await page.reload({ waitUntil: "networkidle" });
    await table.waitFor({ state: "visible", timeout: 10000 });
    console.log("   ✓ Dashboard restored after page reload");

    // Test CSV & Excel exports
    console.log("7. Testing CSV, Excel, and PDF exports...");
    await page.getByRole("button", { name: /Export/i }).click();
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Filtered CSV" }).click(),
    ]);
    assert.ok(csvDownload.suggestedFilename().endsWith(".csv"));
    console.log("   ✓ CSV exported:", csvDownload.suggestedFilename());

    await page.getByRole("button", { name: /Export/i }).click();
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Dashboard Excel (.xlsx)" }).click(),
    ]);
    assert.ok(xlsxDownload.suggestedFilename().endsWith(".xlsx"));
    console.log("   ✓ Excel exported:", xlsxDownload.suggestedFilename());

    await page.getByRole("button", { name: /Export/i }).click();
    const [pdfDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Dashboard PDF" }).click(),
    ]);
    assert.ok(pdfDownload.suggestedFilename().endsWith(".pdf"));
    console.log("   ✓ PDF exported:", pdfDownload.suggestedFilename());

    // Test uploading 1-column CSV
    console.log("8. Testing one-column CSV upload...");
    await page.getByRole("button", { name: "New File" }).click();
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await table.waitFor({ state: "visible", timeout: 10000 });
    const oneColText = await page.getByTestId("table-row-count").textContent();
    assert.ok(oneColText?.includes("3") && oneColText?.includes("1 columns"), `Expected 3 rows, 1 col, got: ${oneColText}`);
    console.log("   ✓ One-column CSV rendered mandatory table:", oneColText?.trim());

    console.log("\nALL E2E BROWSER TESTS PASSED!");
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
