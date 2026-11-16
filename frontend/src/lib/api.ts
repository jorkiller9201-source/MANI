const TOKEN_KEY = "mani_token";
const GUEST_FLAG_KEY = "mani_guest";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isGuestClient(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_FLAG_KEY) === "1";
}

export function setGuestClient(guest: boolean) {
  if (typeof window === "undefined") return;
  if (guest) localStorage.setItem(GUEST_FLAG_KEY, "1");
  else localStorage.removeItem(GUEST_FLAG_KEY);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Site = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elev_km: number;
  notes: string;
};

export type UserMe = {
  id: number;
  email: string;
  full_name: string | null;
  role: string | null;
  must_change_password?: boolean;
  is_guest?: boolean;
};

export type SiteLocation = {
  lat: number;
  lon: number;
  elev_km: number;
  dem_height_m?: number | null;
  dem_height_km?: number | null;
  frame: string;
  horizons_site_coord: string;
  cache_lat: number | null;
  cache_lon: number | null;
  cache_elev_km: number | null;
  location_matches_cache: boolean;
  custom?: boolean;
};

export type CompareResult = {
  a: SiteBlock;
  b: SiteBlock;
  winner_id: string;
  winner_name: string;
  window: {
    start: string;
    end: string;
    requested_start?: string;
    requested_end?: string;
    clamped?: boolean;
    offline_catalog?: boolean;
    live_horizons?: boolean;
    horizons_cache_start?: string;
    horizons_cache_end?: string;
  };
  geo_cross?: {
    a: SiteLocation;
    b: SiteLocation;
    note: string;
  };
  sources: {
    ephemeris: string;
    terrain_context: string;
    topographic_horizon?: string;
  };
  report_en: string;
};

export type LolaHorizonMeta = {
  source: string;
  source_url?: string;
  citation?: string;
  dem_resolution_m?: number;
  observer_height_m?: number;
  dem_height_m?: number | null;
  dem_height_km?: number | null;
  max_range_km?: number;
  horizon_elev_min_deg?: number;
  horizon_elev_max_deg?: number;
};

export type DailyTimelineDay = {
  day: string;
  sun_hours: number;
  earth_hours: number;
};

export type SiteBlock = {
  site: Site;
  location?: SiteLocation;
  lola_horizon?: LolaHorizonMeta;
  sun: BodySummary;
  earth: BodySummary;
  daily_timeline?: DailyTimelineDay[];
  /** Legacy payloads only (replaced by daily_timeline). */
  sun_series?: { time: string; azimuth_deg: number; elevation_deg: number }[];
  earth_series?: { time: string; azimuth_deg: number; elevation_deg: number }[];
  score: number;
  score_geometric?: number;
  meta: { source: string; generated_at?: string; step?: string; horizon_mode?: string };
};

export type BodySummary = {
  samples: number;
  hours_above_horizon: number;
  hours_above_topo_horizon?: number;
  mean_elevation_deg: number | null;
  min_elevation_deg: number | null;
  max_elevation_deg: number | null;
  hours_until_set: number | null;
  hours_until_topo_set?: number | null;
  currently_above: boolean | null;
  currently_above_topo?: boolean | null;
  topo_applied?: boolean;
};

export const authApi = {
  async login(email: string, password: string) {
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || "Login failed");
    }
    const data = await res.json();
    setGuestClient(false);
    setToken(data.access_token);
    return data as { access_token: string; must_change_password?: boolean };
  },
  async loginAsGuest() {
    const data = await api<{ access_token: string; must_change_password?: boolean }>("/auth/guest", {
      method: "POST",
    });
    setGuestClient(true);
    setToken(data.access_token);
    return data;
  },
  async loginWithGoogle(idToken: string) {
    const data = await api<{ access_token: string; must_change_password?: boolean }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
    setGuestClient(false);
    setToken(data.access_token);
    return data;
  },
  async googleStatus() {
    try {
      return await api<{ enabled: boolean }>("/auth/google/status");
    } catch {
      return { enabled: false };
    }
  },
  async register(email: string, password: string, full_name?: string) {
    const data = await api<{ access_token: string; must_change_password?: boolean }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    });
    setGuestClient(false);
    setToken(data.access_token);
    return data;
  },
  async changePassword(
    new_password: string,
  ): Promise<{ ok: boolean; must_change_password?: boolean; access_token?: string }> {
    const data = await api<{ ok: boolean; must_change_password?: boolean; access_token?: string }>(
      "/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ new_password }),
      },
    );
    if (data.access_token) {
      setGuestClient(false);
      setToken(data.access_token);
    }
    return data;
  },
  async forgotPassword(email: string): Promise<{ ok: boolean; dev_logged?: boolean }> {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        login_base: typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    });
    if (!res.ok) {
      let code = "FORGOT_PASSWORD_FAILED";
      try {
        const j = await res.json();
        const d = j.detail;
        if (typeof d === "object" && d?.code) code = d.code;
        else if (typeof d === "string") code = d;
      } catch {
        /* ignore */
      }
      throw new Error(code);
    }
    return res.json();
  },
  me: () => api<UserMe>("/auth/me"),
  async logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setGuestClient(false);
    }
  },
};

export type CompareRequest = {
  start: string;
  end: string;
  site_a?: string | null;
  site_b?: string | null;
  lat_a?: number | null;
  lon_a?: number | null;
  lat_b?: number | null;
  lon_b?: number | null;
  name_a?: string | null;
  name_b?: string | null;
};

export type SavedReportSummary = {
  id: number;
  title: string;
  winner_name: string | null;
  window_start: string;
  window_end: string;
  queried_at: string;
  created_at: string;
};

export type SavedReportDetail = SavedReportSummary & {
  printed_at?: string;
  payload: CompareResult & {
    _meta?: {
      queried_at?: string;
      printed_at?: string;
      saved_by?: string;
      report_text?: string;
      map_image?: string | null;
    };
  };
};

export type SkyBody = {
  body: string;
  azimuth_deg: number | null;
  elevation_deg: number | null;
  above_horizon: boolean | null;
  sample_time?: string | null;
  enu_unit?: number[] | null;
};

export type SkySnapshot = {
  time: string;
  observer: { lat: number; lon: number; elev_km: number; site_id?: string | null };
  sun: SkyBody;
  earth: SkyBody;
  source: string;
  mode: string;
  quantities?: string;
  note?: string;
};

export type HorizonMask = {
  site_id?: string;
  observer_height_m?: number;
  dem_height_m?: number | null;
  azimuth_deg: number[];
  horizon_elev_deg: number[];
  source?: string;
  computed_on_the_fly?: boolean;
};

export const dataApi = {
  sites: () =>
    api<{ sites: Site[]; horizons_window?: { start: string; end: string } | null }>("/sites"),
  compare: (body: CompareRequest) =>
    api<CompareResult>("/compare", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  sky: (q: {
    time: string;
    lat: number;
    lon: number;
    elev_km?: number;
    site_id?: string | null;
  }) => {
    const params = new URLSearchParams({
      time: q.time,
      lat: String(q.lat),
      lon: String(q.lon),
    });
    if (q.elev_km != null) params.set("elev_km", String(q.elev_km));
    if (q.site_id) params.set("site_id", q.site_id);
    return api<SkySnapshot>(`/sky?${params.toString()}`);
  },
  horizon: (q: { lat: number; lon: number; site_id?: string | null }) => {
    const params = new URLSearchParams({
      lat: String(q.lat),
      lon: String(q.lon),
    });
    if (q.site_id) params.set("site_id", q.site_id);
    return api<HorizonMask>(`/horizon?${params.toString()}`);
  },
};

export const reportsApi = {
  list: () => api<{ reports: SavedReportSummary[] }>("/reports"),
  get: (id: number) => api<SavedReportDetail>(`/reports/${id}`),
  save: (body: {
    title: string;
    winner_name?: string | null;
    window_start: string;
    window_end: string;
    queried_at?: string;
    payload: object;
  }) => api<SavedReportDetail>("/reports", { method: "POST", body: JSON.stringify(body) }),
  remove: (id: number) => api<{ ok: boolean }>(`/reports/${id}`, { method: "DELETE" }),
  patchMapImage: (id: number, map_image: string) =>
    api<{ ok: boolean }>(`/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ map_image }),
    }),
};

export type AdminSummary = {
  users_total: number;
  users_active: number;
  users_by_provider: Record<string, number>;
  logins_7d: number;
  compares_7d: number;
  compares_30d: number;
  reports_total: number;
  reports_7d: number;
  guest_compares_7d: number;
  unique_active_users_7d: number;
};

export type AdminUserRow = {
  id: number;
  email: string;
  full_name: string | null;
  auth_provider: string;
  role: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login: string | null;
  reports_count: number;
  compare_count: number;
};

export type AdminActivityRow = {
  id: number;
  created_at: string;
  action: string;
  user_id: number | null;
  user_email: string | null;
  is_guest: boolean;
  detail: Record<string, unknown> | null;
};

export type AdminSiteMetrics = {
  window_days: number;
  top_sites_by_compares: {
    site_key: string;
    label: string;
    compare_count: number;
    win_count: number;
  }[];
  top_sites_by_avg_score: {
    site_key: string;
    label: string;
    avg_score: number;
    max_score: number;
    sample_n: number;
  }[];
  top_winners: { name: string; wins: number }[];
  compares_by_day: { day: string; count: number }[];
  score_by_window: {
    window_start: string;
    window_end: string;
    winner_name: string | null;
    score_a: number | null;
    score_b: number | null;
    n: number;
  }[];
};

export const adminApi = {
  summary: () => api<AdminSummary>("/admin/summary"),
  users: (limit = 100, offset = 0) =>
    api<{ users: AdminUserRow[]; total: number }>(
      `/admin/users?limit=${limit}&offset=${offset}`
    ),
  activity: (opts?: { limit?: number; offset?: number; action?: string; user_id?: number }) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts?.limit ?? 50));
    params.set("offset", String(opts?.offset ?? 0));
    if (opts?.action) params.set("action", opts.action);
    if (opts?.user_id != null) params.set("user_id", String(opts.user_id));
    return api<{ events: AdminActivityRow[]; total: number }>(`/admin/activity?${params}`);
  },
  siteMetrics: (days = 30) => api<AdminSiteMetrics>(`/admin/metrics/sites?days=${days}`),
};
