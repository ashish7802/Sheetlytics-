import { buildColumnKeys, profileColumns } from "./profiler.ts";
import type { DataRow, ParsedWorkbook } from "../../types/dashboard.ts";

export interface SampleDatasetMeta {
  id: "prospects" | "sales" | "inventory";
  name: string;
  description: string;
  rowCount: number;
  badge: string;
}

export const SAMPLE_DATASETS: SampleDatasetMeta[] = [
  {
    id: "prospects",
    name: "B2B Business Prospects",
    description: "Leads, companies, verified emails, deal values, locations, and pipeline stages.",
    rowCount: 24,
    badge: "CRM & Leads",
  },
  {
    id: "sales",
    name: "Quarterly Sales & Revenue",
    description: "Multi-region order revenue, units sold, profit margins, and payment statuses.",
    rowCount: 28,
    badge: "Finance & Sales",
  },
  {
    id: "inventory",
    name: "Warehouse Inventory",
    description: "SKUs, stock levels, reorder thresholds, unit costs, and fulfillment status.",
    rowCount: 20,
    badge: "Operations",
  },
];

function buildWorkbookFromRows(
  fileName: string,
  sheetName: string,
  headers: string[],
  rawRows: Array<Array<string | number | boolean | null>>
): ParsedWorkbook {
  const columnDefs = buildColumnKeys(headers);
  const rows: DataRow[] = rawRows.map((arr) => {
    const obj: DataRow = {};
    columnDefs.forEach((col, i) => {
      obj[col.key] = arr[i] ?? null;
    });
    return obj;
  });
  const columns = profileColumns(columnDefs, rows);
  return {
    fileName,
    fileSize: JSON.stringify(rawRows).length,
    fileType: "sample",
    sheetNames: [sheetName],
    sheets: {
      [sheetName]: {
        name: sheetName,
        columns,
        rows,
        rowCount: rows.length,
        columnCount: columns.length,
      },
    },
    warnings: [],
  };
}

export function getSampleWorkbook(id: SampleDatasetMeta["id"]): ParsedWorkbook {
  if (id === "prospects") {
    return buildWorkbookFromRows(
      "b2b-prospects-sample.xlsx",
      "Prospects",
      [
        "Lead Name",
        "Company",
        "Email",
        "Category",
        "Location",
        "Status",
        "Deal Value",
        "Created Date",
      ],
      [
        ["Elena Rostova", "Northstar Logistics", "elena@northstar.io", "Enterprise", "New York, USA", "Qualified", 48000, "2026-01-12"],
        ["Marcus Vance", "Apex Cloud Systems", "marcus@apexcloud.com", "SaaS", "San Francisco, USA", "Proposal Sent", 32500, "2026-01-18"],
        ["Priya Nair", "Helios Energy", "priya.nair@helios.co", "Enterprise", "Austin, USA", "Won", 74000, "2026-01-24"],
        ["Lucas Meyer", "Rheinwerk GmbH", "l.meyer@rheinwerk.de", "Manufacturing", "Berlin, Germany", "Contacted", 19000, "2026-02-02"],
        ["Sofia Rossi", "Veloce Retail", "sofia@veloceretail.it", "E-Commerce", "Milan, Italy", "Won", 28500, "2026-02-09"],
        ["Daniel Kim", "Kinetix AI Labs", "daniel@kinetix.ai", "SaaS", "Seattle, USA", "Qualified", 41000, "2026-02-14"],
        ["Hannah Abbott", "BrightPath Health", "hannah@brightpath.org", "Healthcare", "Boston, USA", "New", 15000, "2026-02-19"],
        ["Mateo Silva", "Andes FinTech", "mateo@andesfin.com", "FinTech", "Miami, USA", "Proposal Sent", 56000, "2026-03-01"],
        ["Chloe Bennett", "Thames Media Group", "chloe@thamesmedia.co.uk", "Media", "London, UK", "Lost", 22000, "2026-03-06"],
        ["Arjun Mehta", "Indus Robotics", "arjun@indusrobotics.in", "Manufacturing", "Bengaluru, India", "Won", 63000, "2026-03-11"],
        ["Claire Dubois", "Lumiere Commerce", "claire@lumiere.fr", "E-Commerce", "Paris, France", "Qualified", 29000, "2026-03-18"],
        ["Noah Williams", "Summit Financial", "noah@summitfin.com", "FinTech", "Chicago, USA", "Won", 85000, "2026-03-25"],
        ["Isabella Cruz", "Solstice Solar", "isabella@solsticesolar.com", "Enterprise", "Denver, USA", "Contacted", 34000, "2026-04-02"],
        ["Liam O'Connor", "Emerald Bio", "liam@emeraldbio.ie", "Healthcare", "Dublin, Ireland", "Proposal Sent", 47500, "2026-04-08"],
        ["Yuki Tanaka", "Kuroda Precision", "yuki@kuroda.jp", "Manufacturing", "Tokyo, Japan", "Won", 91000, "2026-04-14"],
        ["Rachel Green", "Pulse Commerce", "rachel@pulsecommerce.com", "E-Commerce", "Toronto, Canada", "Qualified", 24000, "2026-04-21"],
        ["Omar Hassan", "Crescent Pay", "omar@crescentpay.ae", "FinTech", "Dubai, UAE", "New", 52000, "2026-04-27"],
        ["Grace Lee", "Veritas Cloud", "grace@veritascloud.io", "SaaS", "Singapore", "Won", 39000, "2026-05-03"],
        ["Ethan Brooks", "Ironclad Security", "ethan@ironclad.sec", "SaaS", "New York, USA", "Proposal Sent", 61000, "2026-05-09"],
        ["Maya Lin", "Pacific Freight", null, "Enterprise", "Los Angeles, USA", "Contacted", 44000, "2026-05-14"],
        ["Victor Hugo", "Atlas Logistics", "victor@atlaslog.com", "Enterprise", "London, UK", "Won", 72000, "2026-05-20"],
        ["Nina Patel", "MedCore Diagnostics", "nina@medcore.com", "Healthcare", "Boston, USA", "Qualified", 36500, "2026-05-24"],
        ["Owen Wright", "Harbor Analytics", null, "SaaS", "Seattle, USA", "Lost", 18000, "2026-05-29"],
        ["Amara Okafor", "Nova Retail", "amara@novaretail.co", "E-Commerce", "London, UK", "Won", 31000, "2026-06-04"],
      ]
    );
  }

  if (id === "sales") {
    return buildWorkbookFromRows(
      "quarterly-sales-revenue.xlsx",
      "Orders",
      ["Order ID", "Order Date", "Region", "Category", "Units Sold", "Revenue", "Profit", "Payment Status"],
      [
        ["ORD-1001", "2026-01-05", "North America", "Software", 14, 18200, 12740, "Paid"],
        ["ORD-1002", "2026-01-11", "Europe", "Hardware", 9, 13500, 4725, "Paid"],
        ["ORD-1003", "2026-01-19", "Asia Pacific", "Services", 6, 9600, 5760, "Paid"],
        ["ORD-1004", "2026-01-27", "North America", "Cloud", 22, 26400, 19800, "Paid"],
        ["ORD-1005", "2026-02-03", "Europe", "Software", 18, 21600, 15120, "Paid"],
        ["ORD-1006", "2026-02-10", "Latin America", "Hardware", 7, 10500, 3675, "Pending"],
        ["ORD-1007", "2026-02-16", "North America", "Services", 11, 16500, 9900, "Paid"],
        ["ORD-1008", "2026-02-24", "Asia Pacific", "Cloud", 15, 19500, 14625, "Paid"],
        ["ORD-1009", "2026-03-02", "Europe", "Cloud", 20, 24000, 18000, "Paid"],
        ["ORD-1010", "2026-03-09", "North America", "Hardware", 12, 18000, 6300, "Paid"],
        ["ORD-1011", "2026-03-15", "Middle East", "Software", 8, 11200, 7840, "Overdue"],
        ["ORD-1012", "2026-03-22", "Asia Pacific", "Software", 19, 24700, 17290, "Paid"],
        ["ORD-1013", "2026-03-29", "Europe", "Services", 10, 14000, 8400, "Paid"],
        ["ORD-1014", "2026-04-04", "North America", "Cloud", 28, 33600, 25200, "Paid"],
        ["ORD-1015", "2026-04-12", "Latin America", "Software", 11, 13200, 9240, "Paid"],
        ["ORD-1016", "2026-04-19", "Europe", "Hardware", 14, 21000, 7350, "Pending"],
        ["ORD-1017", "2026-04-26", "Asia Pacific", "Services", 9, 13500, 8100, "Paid"],
        ["ORD-1018", "2026-05-03", "North America", "Software", 25, 32500, 22750, "Paid"],
        ["ORD-1019", "2026-05-10", "Middle East", "Cloud", 16, 20800, 15600, "Paid"],
        ["ORD-1020", "2026-05-17", "Europe", "Cloud", 23, 27600, 20700, "Paid"],
        ["ORD-1021", "2026-05-24", "North America", "Services", 13, 19500, 11700, "Paid"],
        ["ORD-1022", "2026-05-31", "Asia Pacific", "Hardware", 11, 16500, 5775, "Pending"],
        ["ORD-1023", "2026-06-06", "Europe", "Software", 21, 27300, 19110, "Paid"],
        ["ORD-1024", "2026-06-13", "North America", "Cloud", 31, 37200, 27900, "Paid"],
        ["ORD-1025", "2026-06-20", "Latin America", "Cloud", 12, 14400, 10800, "Paid"],
        ["ORD-1026", "2026-06-25", "Asia Pacific", "Software", 24, 31200, 21840, "Paid"],
        ["ORD-1027", "2026-06-28", "Middle East", "Hardware", 6, 9000, 3150, "Overdue"],
        ["ORD-1028", "2026-06-30", "North America", "Software", 27, 35100, 24570, "Paid"],
      ]
    );
  }

  return buildWorkbookFromRows(
    "warehouse-inventory.xlsx",
    "Inventory",
    ["SKU", "Product Name", "Category", "Warehouse", "Stock Qty", "Reorder Level", "Unit Cost", "Status"],
    [
      ["SKU-101", "ErgoMesh Pro Chair", "Furniture", "East Hub", 142, 40, 240, "In Stock"],
      ["SKU-102", "Standing Desk 60in", "Furniture", "West Hub", 28, 30, 410, "Low Stock"],
      ["SKU-103", "USB-C Dock Station", "Electronics", "East Hub", 310, 75, 85, "In Stock"],
      ["SKU-104", "4K Monitor 27in", "Electronics", "Central Hub", 18, 25, 320, "Low Stock"],
      ["SKU-105", "Mechanical Keyboard", "Accessories", "East Hub", 205, 50, 72, "In Stock"],
      ["SKU-106", "Wireless Mouse Pro", "Accessories", "West Hub", 0, 60, 45, "Out of Stock"],
      ["SKU-107", "Noise-Canceling Headset", "Electronics", "Central Hub", 84, 30, 155, "In Stock"],
      ["SKU-108", "Acoustic Desk Panel", "Furniture", "East Hub", 64, 20, 95, "In Stock"],
      ["SKU-109", "Laptop Riser Aluminum", "Accessories", "West Hub", 190, 40, 38, "In Stock"],
      ["SKU-110", "Webcam 4K HDR", "Electronics", "East Hub", 12, 25, 110, "Low Stock"],
      ["SKU-111", "Conference Speaker", "Electronics", "Central Hub", 47, 20, 180, "In Stock"],
      ["SKU-112", "Cable Management Kit", "Accessories", "East Hub", 420, 100, 18, "In Stock"],
      ["SKU-113", "Dual Monitor Arm", "Furniture", "West Hub", 35, 30, 125, "In Stock"],
      ["SKU-114", "LED Task Lamp", "Accessories", "Central Hub", 0, 35, 52, "Out of Stock"],
      ["SKU-115", "Smart Power Strip", "Electronics", "East Hub", 275, 60, 34, "In Stock"],
      ["SKU-116", "Drafting Stool", "Furniture", "Central Hub", 16, 20, 195, "Low Stock"],
      ["SKU-117", "Thunderbolt Cable 2m", "Accessories", "West Hub", 510, 100, 24, "In Stock"],
      ["SKU-118", "Portable SSD 2TB", "Electronics", "East Hub", 93, 30, 165, "In Stock"],
      ["SKU-119", "Whiteboard Glass 4x6", "Furniture", "Central Hub", 22, 15, 290, "In Stock"],
      ["SKU-120", "Privacy Screen 27in", "Accessories", "West Hub", 14, 25, 48, "Low Stock"],
    ]
  );
}
