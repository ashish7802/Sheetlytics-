import type { DashboardConfig, ParsedWorkbook } from "../../types/dashboard.ts";

export interface SavedDashboardEntry {
  id: string;
  fileName: string;
  title: string;
  rowCount: number;
  columnCount: number;
  updatedAt: string;
  workbook: ParsedWorkbook;
  config: DashboardConfig;
}

const DB_NAME = "sheetlytics_local_db";
const DB_VERSION = 1;
const STORE_NAME = "dashboards";
const ACTIVE_ID_KEY = "sheetlytics_active_dashboard_id";
const FALLBACK_STORAGE_KEY = "sheetlytics_saved_dashboards_v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

export function buildDashboardStorageId(fileName: string, fileSize: number): string {
  return `${fileName}::${fileSize}`;
}

export async function saveDashboardLocally(entry: SavedDashboardEntry): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_ID_KEY, entry.id);
  } catch {
    // Ignore storage quota errors
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage for smaller workbooks
    try {
      const existing = loadFallbackEntries().filter((e) => e.id !== entry.id);
      const next = [entry, ...existing].slice(0, 5);
      window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota exceeded for very large workbooks
    }
  }
}

function loadFallbackEntries(): SavedDashboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listSavedDashboards(): Promise<SavedDashboardEntry[]> {
  if (typeof window === "undefined") return [];
  try {
    const db = await openDb();
    const entries = await new Promise<SavedDashboardEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as SavedDashboardEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return loadFallbackEntries().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export async function loadActiveDashboard(): Promise<SavedDashboardEntry | null> {
  if (typeof window === "undefined") return null;
  let activeId: string | null = null;
  try {
    activeId = window.localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
  if (!activeId) return null;

  const all = await listSavedDashboards();
  return all.find((e) => e.id === activeId) ?? null;
}

export function clearActiveDashboardSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_ID_KEY);
  } catch {
    // Ignore
  }
}

export async function clearAllSavedDashboards(): Promise<void> {
  if (typeof window === "undefined") return;
  clearActiveDashboardSession();
  try {
    window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
  } catch {
    // Ignore
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}
