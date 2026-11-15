/**
 * Guest-only persistence: browser localStorage / WebView cache.
 * Never send these payloads to /reports on the server.
 */

import type { CompareResult, SavedReportDetail, SavedReportSummary } from "./api";

const REPORTS_KEY = "mani_guest_reports";
const PREFS_KEY = "mani_guest_prefs";

export type GuestPrefs = {
  siteA?: string;
  siteB?: string;
  customA?: { lat: number; lon: number; name?: string } | null;
  customB?: { lat: number; lon: number; name?: string } | null;
  start?: string;
  end?: string;
  skyTime?: string;
};

function readReports(): SavedReportDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedReportDetail[]) : [];
  } catch {
    return [];
  }
}

function writeReports(rows: SavedReportDetail[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REPORTS_KEY, JSON.stringify(rows));
}

export const guestReports = {
  list(): SavedReportSummary[] {
    return readReports().map(
      ({ id, title, winner_name, window_start, window_end, queried_at, created_at }) => ({
        id,
        title,
        winner_name,
        window_start,
        window_end,
        queried_at,
        created_at,
      })
    );
  },

  get(id: number): SavedReportDetail | null {
    return readReports().find((r) => r.id === id) ?? null;
  },

  save(body: {
    title: string;
    winner_name?: string | null;
    window_start: string;
    window_end: string;
    queried_at?: string;
    payload: CompareResult & {
      _meta?: Record<string, unknown>;
    };
  }): SavedReportDetail {
    const now = new Date().toISOString();
    const rows = readReports();
    const id = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
    const queried_at = body.queried_at || now;
    const payload = {
      ...body.payload,
      _meta: {
        ...(body.payload._meta || {}),
        queried_at,
        printed_at: now,
        saved_by: "guest",
        local_only: true,
      },
    };
    const row: SavedReportDetail = {
      id,
      title: body.title.slice(0, 255),
      winner_name: body.winner_name ?? null,
      window_start: body.window_start,
      window_end: body.window_end,
      queried_at,
      created_at: now,
      printed_at: now,
      payload,
    };
    writeReports([row, ...rows].slice(0, 50));
    return row;
  },

  patchMapImage(id: number, map_image: string): boolean {
    const rows = readReports();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    const payload = { ...rows[idx].payload };
    const meta = { ...(payload._meta || {}), map_image };
    payload._meta = meta;
    rows[idx] = { ...rows[idx], payload };
    writeReports(rows);
    return true;
  },

  remove(id: number): boolean {
    const rows = readReports();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    writeReports(next);
    return true;
  },

  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(REPORTS_KEY);
  },
};

export const guestPrefs = {
  load(): GuestPrefs | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? (JSON.parse(raw) as GuestPrefs) : null;
    } catch {
      return null;
    }
  },

  save(prefs: GuestPrefs) {
    if (typeof window === "undefined") return;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(PREFS_KEY);
  },
};
