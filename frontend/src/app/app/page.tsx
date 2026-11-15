"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authApi,
  dataApi,
  getToken,
  type CompareResult,
  type Site,
  type UserMe,
} from "@/lib/api";
import { guestPrefs } from "@/lib/guestStorage";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";
import { buildLocalizedReport } from "@/i18n/buildReport";
import ReportExport from "@/modules/report/ReportExport";
import ReportHistory from "@/modules/report/ReportHistory";
import ReportDailyTimeline from "@/modules/report/ReportDailyTimeline";
import AdminPanel from "@/modules/admin/AdminPanel";
import { resolveDailyTimeline } from "@/modules/report/dailyTimeline";
import UtcDateTimePicker from "@/components/UtcDateTimePicker";

function fmtCoord(n: number, digits = 4) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function customSiteName(lat: number, lon: number) {
  return `${fmtCoord(lat)}°, ${fmtCoord(lon)}°`;
}

const MoonMap = dynamic(() => import("@/modules/moon/MoonMap"), { ssr: false });

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function SiteCard({
  title,
  block,
  accent,
  labels,
}: {
  title: string;
  block: CompareResult["a"];
  accent: string;
  labels: {
    score: string;
    scoreGeometric: string;
    location: string;
    lat: string;
    lon: string;
    elevKm: string;
    elevLolaKm: string;
    sunHours: string;
    earthHours: string;
    sunHoursTopo: string;
    earthHoursTopo: string;
    sunMeanElev: string;
    earthMeanElev: string;
    hoursUntilSunset: string;
    hoursUntilEarthset: string;
    metricNote: string;
  };
}) {
  const lat = block.location?.lat ?? block.site.lat;
  const lon = block.location?.lon ?? block.site.lon;
  // Prefer LOLA DEM height (m→km). Catalog elev_km is Horizons SITE_COORD (usually 0).
  const elevKmRaw =
    block.lola_horizon?.dem_height_km ??
    block.location?.dem_height_km ??
    (block.lola_horizon?.dem_height_m != null ? block.lola_horizon.dem_height_m / 1000 : null) ??
    (block.location?.dem_height_m != null ? block.location.dem_height_m / 1000 : null);
  const hasLolaElev = elevKmRaw != null && Number.isFinite(elevKmRaw);
  const elevKm = hasLolaElev ? (elevKmRaw as number) : (block.location?.elev_km ?? block.site.elev_km ?? 0);
  const elevLabel = hasLolaElev ? labels.elevLolaKm : labels.elevKm;
  const sunTopo = block.sun.hours_above_topo_horizon ?? block.sun.hours_above_horizon;
  const earthTopo = block.earth.hours_above_topo_horizon ?? block.earth.hours_above_horizon;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold" style={{ color: accent }}>
          {title}: {block.site.name}
        </h3>
        <span className="text-sm text-white/70">
          {labels.score} {block.score}
          {block.score_geometric != null && (
            <span className="ml-2 text-white/40">
              ({labels.scoreGeometric} {block.score_geometric})
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/55">
        {labels.location}: {labels.lat} {fmtCoord(lat)}° · {labels.lon} {fmtCoord(lon)}°
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          label={elevLabel}
          value={hasLolaElev ? `${fmtCoord(elevKm, 3)} km` : "—"}
        />
        <Metric label={labels.score} value={`${block.score}`} />
        <Metric label={labels.sunHoursTopo} value={`${sunTopo} h`} />
        <Metric label={labels.earthHoursTopo} value={`${earthTopo} h`} />
        <Metric label={labels.sunHours} value={`${block.sun.hours_above_horizon} h`} />
        <Metric label={labels.earthHours} value={`${block.earth.hours_above_horizon} h`} />
        <Metric label={labels.sunMeanElev} value={`${block.sun.mean_elevation_deg ?? "—"}°`} />
        <Metric label={labels.earthMeanElev} value={`${block.earth.mean_elevation_deg ?? "—"}°`} />
        <Metric
          label={labels.hoursUntilSunset}
          value={`${block.sun.hours_until_topo_set ?? block.sun.hours_until_set ?? "—"} h`}
        />
        <Metric
          label={labels.hoursUntilEarthset}
          value={`${block.earth.hours_until_topo_set ?? block.earth.hours_until_set ?? "—"} h`}
        />
      </div>
      <p className="mt-2 text-[11px] text-white/40">{labels.metricNote}</p>
    </div>
  );
}

export default function AppPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteA, setSiteA] = useState("shackleton_rim");
  const [siteB, setSiteB] = useState("malapert");
  const [customA, setCustomA] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [customB, setCustomB] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [start, setStart] = useState("2026-11-15T00:00:00Z");
  const [end, setEnd] = useState("2026-11-28T23:00:00Z");
  const [skyTime, setSkyTime] = useState("2026-11-15T00:00:00Z");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickTarget, setPickTarget] = useState<"a" | "b">("a");
  const pickTargetRef = useRef(pickTarget);
  pickTargetRef.current = pickTarget;
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null);
  const [focusLatLon, setFocusLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [offline, setOffline] = useState(false);
  const [queriedAt, setQueriedAt] = useState<string>("");
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [horizonsWindow, setHorizonsWindow] = useState<{ start: string; end: string } | null>(
    null
  );
  const [windowNotice, setWindowNotice] = useState("");
  const reportText = useMemo(
    () => (result ? buildLocalizedReport(lang, result) : ""),
    [result, lang]
  );

  useEffect(() => {
    setMounted(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (me.must_change_password) {
          router.replace("/change-password");
          return;
        }
        setUser(me);
        if (me.is_guest) {
          const prefs = guestPrefs.load();
          if (prefs) {
            if (prefs.siteA) setSiteA(prefs.siteA);
            if (prefs.siteB) setSiteB(prefs.siteB);
            if (prefs.customA !== undefined) setCustomA(prefs.customA);
            if (prefs.customB !== undefined) setCustomB(prefs.customB);
            if (prefs.start) setStart(prefs.start);
            if (prefs.end) setEnd(prefs.end);
            if (prefs.skyTime) setSkyTime(prefs.skyTime);
          }
        }
      })
      .catch(() => {
        router.replace("/login");
      });
    dataApi
      .sites()
      .then((r) => {
        setSites(r.sites);
        if (r.horizons_window) setHorizonsWindow(r.horizons_window);
      })
      .catch((e) => setError(e.message));
  }, [mounted, router]);

  useEffect(() => {
    if (!user?.is_guest) return;
    guestPrefs.save({
      siteA,
      siteB,
      customA,
      customB,
      start,
      end,
      skyTime,
    });
  }, [user?.is_guest, siteA, siteB, customA, customB, start, end, skyTime]);

  function onMapSelect(id: string) {
    const slot = pickTargetRef.current;
    if (slot === "a") {
      setCustomA(null);
      setSiteA(id);
      setFocusLatLon(null);
      setFocusSiteId(id);
      setFocusNonce((n) => n + 1);
    } else {
      setCustomB(null);
      setSiteB(id);
      setFocusLatLon(null);
      setFocusSiteId(id);
      setFocusNonce((n) => n + 1);
    }
  }

  function applyCustomToSlot(slot: "a" | "b", lat: number, lon: number) {
    const name = customSiteName(lat, lon);
    if (slot === "a") {
      setCustomA({ lat, lon, name });
    } else {
      setCustomB({ lat, lon, name });
    }
    setFocusLatLon({ lat, lon });
    setFocusSiteId(null);
    setFocusNonce((n) => n + 1);
  }

  function onPickPoint(lat: number, lon: number) {
    applyCustomToSlot(pickTargetRef.current, lat, lon);
  }

  function goToSlot(slot: "a" | "b") {
    setPickTarget(slot);
    const custom = slot === "a" ? customA : customB;
    if (custom) {
      setFocusLatLon({ lat: custom.lat, lon: custom.lon });
      setFocusSiteId(null);
    } else {
      setFocusLatLon(null);
      setFocusSiteId(slot === "a" ? siteA : siteB);
    }
    setFocusNonce((n) => n + 1);
  }

  async function runCompare() {
    setBusy(true);
    setError("");
    setWindowNotice("");
    try {
      const r = await dataApi.compare({
        start,
        end,
        site_a: customA ? null : siteA,
        site_b: customB ? null : siteB,
        lat_a: customA?.lat ?? null,
        lon_a: customA?.lon ?? null,
        lat_b: customB?.lat ?? null,
        lon_b: customB?.lon ?? null,
        name_a: customA?.name ?? null,
        name_b: customB?.name ?? null,
      });
      setResult(r);
      setQueriedAt(new Date().toISOString());
      if (r.window.clamped) {
        setWindowNotice(
          t("windowClampedNotice", { start: r.window.start, end: r.window.end })
        );
      }
    } catch (e: any) {
      const raw = e.message || t("compareFailed");
      const needNet =
        typeof raw === "string" &&
        (raw.includes("Connect to the Internet") || raw.includes("Conéctate a Internet"));
      setError(needNet ? t("horizonsNeedInternet") : raw);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await authApi.logout();
    router.replace("/");
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const siteAMeta = customA ?? sites.find((s) => s.id === siteA);
  const siteBMeta = customB ?? sites.find((s) => s.id === siteB);
  const skySiteMeta = pickTarget === "b" ? siteBMeta : siteAMeta;
  const skyObserver = skySiteMeta
    ? {
        lat: skySiteMeta.lat,
        lon: skySiteMeta.lon,
        elev_km:
          "elev_km" in skySiteMeta && typeof skySiteMeta.elev_km === "number"
            ? skySiteMeta.elev_km
            : 0,
        site_id:
          pickTarget === "b"
            ? customB
              ? null
              : siteB
            : customA
              ? null
              : siteA,
        name:
          skySiteMeta.name ||
          (pickTarget === "b"
            ? customB
              ? customSiteName(customB.lat, customB.lon)
              : siteB
            : customA
              ? customSiteName(customA.lat, customA.lon)
              : siteA),
        slot: pickTarget,
      }
    : null;
  const samePoint =
    customA && customB
      ? Math.abs(customA.lat - customB.lat) < 1e-6 && Math.abs(customA.lon - customB.lon) < 1e-6
      : !customA && !customB && siteA === siteB;

  const cardLabels = {
    score: t("score"),
    scoreGeometric: t("scoreGeometric"),
    location: t("location"),
    lat: t("lat"),
    lon: t("lon"),
    elevKm: t("elevKm"),
    elevLolaKm: t("elevLolaKm"),
    sunHours: t("sunHours"),
    earthHours: t("earthHours"),
    sunHoursTopo: t("sunHoursTopo"),
    earthHoursTopo: t("earthHoursTopo"),
    sunMeanElev: t("sunMeanElev"),
    earthMeanElev: t("earthMeanElev"),
    hoursUntilSunset: t("hoursUntilSunset"),
    hoursUntilEarthset: t("hoursUntilEarthset"),
    metricNote: t("metricNote"),
  };

  // Same placeholder on server + first client paint → no hydration mismatch.
  if (!mounted) {
    return (
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-4 text-white/60">
        MANI
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
      <header className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image
            src="/mani-logo.png"
            alt="MANI"
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 sm:h-14 sm:w-14"
            priority
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#f2d27a] sm:text-xs">{t("brandSub")}</div>
            <h1 className="truncate text-lg font-semibold text-white sm:text-2xl">{t("appTitle")}</h1>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2 text-xs text-white/70 sm:gap-3 sm:text-sm"
          suppressHydrationWarning
        >
          {user?.is_guest ? (
            <span className="inline-flex max-w-[16rem] items-center gap-1.5 truncate" suppressHydrationWarning>
              <span className="truncate font-medium text-white">{t("guestLabel")}</span>
              <span className="shrink-0 rounded border border-[#f2d27a]/45 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#f2d27a]">
                {t("guestBadge")}
              </span>
            </span>
          ) : (
            <span className="hidden max-w-[12rem] truncate md:inline" suppressHydrationWarning>
              {user?.email}
            </span>
          )}
          <LanguageSelector />
          <AboutButton />
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="inline-flex items-center justify-center rounded border border-[#f2d27a]/50 p-1.5 text-[#f2d27a] sm:px-2.5 sm:py-1.5"
              aria-label={t("adminOpen")}
              title={t("adminOpen")}
              suppressHydrationWarning
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.07 7.07 0 0 0-1.62-.94l-.36-2.54A.48.48 0 0 0 14 2h-4a.48.48 0 0 0-.48.42l-.36 2.54c-.58.23-1.12.54-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.65 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.4 1.04.72 1.62.94l.36 2.54c.05.24.24.42.48.42h4c.24 0 .44-.18.48-.42l.36-2.54c.58-.23 1.12-.54 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
              </svg>
            </button>
          )}
          <a
            href="/downloads/mani.apk"
            download="mani-nova3.apk"
            className="rounded border border-[#f2d27a]/50 px-2.5 py-1.5 text-[#f2d27a] sm:px-3"
            title={t("downloadApkHint")}
          >
            {t("downloadApk")}
          </a>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded border border-white/20 px-2.5 py-1.5 text-white sm:px-3"
            suppressHydrationWarning
          >
            {t("historyOpen")}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-white/20 px-2.5 py-1.5 text-white sm:px-3"
            suppressHydrationWarning
          >
            {t("logOut")}
          </button>
        </div>
      </header>

      {user?.is_guest && (
        <p className="mb-3 text-xs text-white/50" suppressHydrationWarning>
          {t("guestLocalNote")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="aspect-[4/3] w-full min-h-[240px] max-h-[62vh] sm:aspect-square sm:max-h-[70vh]">
          {sites.length > 0 ? (
            <MoonMap
              sites={sites}
              siteA={customA ? undefined : siteA}
              siteB={customB ? undefined : siteB}
              customA={customA}
              customB={customB}
              onSelect={onMapSelect}
              onPickPoint={onPickPoint}
              offline={offline}
              focusSiteId={focusSiteId}
              focusLatLon={focusLatLon}
              focusNonce={focusNonce}
              skyTime={skyTime}
              onSkyTimeChange={setSkyTime}
              skyObserver={skyObserver}
              compareStart={start}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/10 text-white/50">
              {t("loadingMap")}
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-4">
          <p className="text-[11px] leading-relaxed text-white/50">{t("mapClickHint")}</p>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => goToSlot("a")}
              className={`rounded px-2 py-1 ${pickTarget === "a" ? "bg-[#f2d27a] text-[#0b1f3a]" : "bg-white/10"}`}
            >
              {t("mapPicksA")}
            </button>
            <button
              type="button"
              onClick={() => goToSlot("b")}
              className={`rounded px-2 py-1 ${pickTarget === "b" ? "bg-[#7ec8ff] text-[#0b1f3a]" : "bg-white/10"}`}
            >
              {t("mapPicksB")}
            </button>
          </div>

          <label className="block text-xs text-white/55">
            {t("siteA")}
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
              value={customA ? "__custom__" : siteA}
              disabled={pickTarget !== "a"}
              onChange={(e) => {
                if (pickTarget !== "a" || e.target.value === "__custom__") return;
                setCustomA(null);
                setSiteA(e.target.value);
              }}
            >
              {customA && (
                <option value="__custom__">{customA.name ?? customSiteName(customA.lat, customA.lon)}</option>
              )}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {siteAMeta && (
              <span className="mt-1 block text-[11px] text-white/40">
                {t("lat")} {fmtCoord(siteAMeta.lat)}° · {t("lon")} {fmtCoord(siteAMeta.lon)}°
              </span>
            )}
          </label>
          <label className="block text-xs text-white/55">
            {t("siteB")}
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
              value={customB ? "__custom__" : siteB}
              disabled={pickTarget !== "b"}
              onChange={(e) => {
                if (pickTarget !== "b" || e.target.value === "__custom__") return;
                setCustomB(null);
                setSiteB(e.target.value);
              }}
            >
              {customB && (
                <option value="__custom__">{customB.name ?? customSiteName(customB.lat, customB.lon)}</option>
              )}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {siteBMeta && (
              <span className="mt-1 block text-[11px] text-white/40">
                {t("lat")} {fmtCoord(siteBMeta.lat)}° · {t("lon")} {fmtCoord(siteBMeta.lon)}°
              </span>
            )}
          </label>
          <label className="block text-xs text-white/55">
            {t("startUtc")}
            <UtcDateTimePicker value={start} onChange={setStart} timeIntervals={60} />
          </label>
          <label className="block text-xs text-white/55">
            {t("endUtc")}
            <UtcDateTimePicker value={end} onChange={setEnd} timeIntervals={60} />
          </label>
          {horizonsWindow && !customA && !customB && (
            <p className="text-[11px] leading-snug text-white/50">
              {t(offline ? "horizonsOfflineHint" : "horizonsOnlineHint", {
                start: horizonsWindow.start,
                end: horizonsWindow.end,
              })}
            </p>
          )}
          <button
            type="button"
            disabled={busy || samePoint}
            onClick={runCompare}
            className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-50"
          >
            {busy ? (customA || customB ? t("comparingLive") : t("comparing")) : t("compareSites")}
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
          {windowNotice && <p className="text-sm text-amber-200/90">{windowNotice}</p>}
        </aside>
      </div>

      {result && (
        <section className="mt-6 space-y-4">
          <div className="rounded-lg border border-[#f2d27a]/35 bg-[#f2d27a]/10 px-4 py-3 text-sm">
            <strong className="text-[#f2d27a]">{t("recommendation")}</strong> {result.winner_name}{" "}
            {t("winsForWindow")}
            <p className="mt-1 text-[11px] text-white/55">{t("geoCrossNote")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SiteCard title={t("labelA")} block={result.a} accent="#f2d27a" labels={cardLabels} />
            <SiteCard title={t("labelB")} block={result.b} accent="#7ec8ff" labels={cardLabels} />
          </div>
          <section className="mani-sheet__timelines" aria-label={t("exportTimelineSection")}>
            <h2 className="mani-sheet__timelines-head">{t("exportTimelineSection")}</h2>
            <p className="mani-sheet__timelines-lead">{t("exportTimelineLead")}</p>
            <p className="mb-2 text-[11px] text-white/45">
              {t("startUtc")}: <span className="text-white/70">{result.window.start}</span>
              {" · "}
              {t("endUtc")}: <span className="text-white/70">{result.window.end}</span>
            </p>
            <ReportDailyTimeline
              optionLabel={t("exportTimelineOptionA")}
              siteName={result.a.site.name}
              days={resolveDailyTimeline(result.a)}
              legendSun={t("exportTimelineLegendSun")}
              legendEarth={t("exportTimelineLegendEarth")}
              axisHours={t("exportTimelineAxisHours")}
              empty={t("exportTimelineEmpty")}
            />
            <ReportDailyTimeline
              optionLabel={t("exportTimelineOptionB")}
              siteName={result.b.site.name}
              days={resolveDailyTimeline(result.b)}
              legendSun={t("exportTimelineLegendSun")}
              legendEarth={t("exportTimelineLegendEarth")}
              axisHours={t("exportTimelineAxisHours")}
              empty={t("exportTimelineEmpty")}
            />
          </section>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{t("reportTitle")}</h2>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs text-white/60" onClick={copyReport}>
                  {copied ? t("copied") : t("copy")}
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="rounded bg-[#f2d27a] px-3 py-1.5 text-xs font-semibold text-[#0b1f3a]"
                >
                  {t("exportReport")}
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{reportText}</pre>
            <p className="mt-3 text-[11px] text-white/40">
              {t("sources")} {result.sources.ephemeris} ·{" "}
              {result.sources.topographic_horizon ?? t("reportLola")} · {result.sources.terrain_context}
            </p>
          </div>
        </section>
      )}

      {result && queriedAt && (
        <ReportExport
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          result={result}
          reportText={reportText}
          queriedAt={queriedAt}
          guestMode={Boolean(user?.is_guest)}
        />
      )}
      <ReportHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        guestMode={Boolean(user?.is_guest)}
      />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  );
}
