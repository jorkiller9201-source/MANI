"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authApi,
  dataApi,
  getToken,
  type CompareResult,
  type Site,
  type UserMe,
} from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";
import { buildLocalizedReport } from "@/i18n/buildReport";
import ReportExport from "@/modules/report/ReportExport";
import ReportHistory from "@/modules/report/ReportHistory";
import ReportDailyTimeline from "@/modules/report/ReportDailyTimeline";
import { resolveDailyTimeline } from "@/modules/report/dailyTimeline";

function fmtCoord(n: number, digits = 4) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
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
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null);
  const [focusLatLon, setFocusLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [offline, setOffline] = useState(false);
  const [queriedAt, setQueriedAt] = useState<string>("");
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
      .then(setUser)
      .catch(() => {
        router.replace("/login");
      });
    dataApi.sites().then((r) => setSites(r.sites)).catch((e) => setError(e.message));
  }, [mounted, router]);

  function onMapSelect(id: string) {
    if (pickTarget === "a") {
      setCustomA(null);
      setSiteA(id);
      setPickTarget("b");
    } else {
      setCustomB(null);
      setSiteB(id);
    }
  }

  function onPickPoint(lat: number, lon: number) {
    const name =
      pickTarget === "a"
        ? `${t("labelA")} (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`
        : `${t("labelB")} (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;
    if (pickTarget === "a") {
      setCustomA({ lat, lon, name });
      setPickTarget("b");
    } else {
      setCustomB({ lat, lon, name });
    }
    setFocusLatLon({ lat, lon });
    setFocusSiteId(null);
    setFocusNonce((n) => n + 1);
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
    } catch (e: any) {
      setError(e.message || t("compareFailed"));
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
        elev_km: "elev_km" in skySiteMeta ? skySiteMeta.elev_km ?? 0 : 0,
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
              ? t("customPoint")
              : siteB
            : customA
              ? t("customPoint")
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
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/mani-logo.png"
            alt="MANI"
            width={56}
            height={56}
            className="h-14 w-14"
            priority
          />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#f2d27a]">{t("brandSub")}</div>
            <h1 className="text-2xl font-semibold text-white">{t("appTitle")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/70" suppressHydrationWarning>
          <span suppressHydrationWarning>{user?.email}</span>
          <LanguageSelector />
          <AboutButton />
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded border border-white/20 px-3 py-1.5 text-white"
            suppressHydrationWarning
          >
            {t("historyOpen")}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-white/20 px-3 py-1.5 text-white"
            suppressHydrationWarning
          >
            {t("logOut")}
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="aspect-square w-full max-h-[70vh]">
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
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              value={customA ? "__custom__" : siteA}
              onChange={(e) => {
                if (e.target.value === "__custom__") return;
                setCustomA(null);
                setSiteA(e.target.value);
                setPickTarget("a");
              }}
              onFocus={() => setPickTarget("a")}
            >
              {customA && (
                <option value="__custom__">
                  {t("customPoint")} ({fmtCoord(customA.lat)}°, {fmtCoord(customA.lon)}°)
                </option>
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
                {customA ? ` · ${t("customPoint")}` : ""}
              </span>
            )}
          </label>
          <label className="block text-xs text-white/55">
            {t("siteB")}
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              value={customB ? "__custom__" : siteB}
              onChange={(e) => {
                if (e.target.value === "__custom__") return;
                setCustomB(null);
                setSiteB(e.target.value);
                setPickTarget("b");
              }}
              onFocus={() => setPickTarget("b")}
            >
              {customB && (
                <option value="__custom__">
                  {t("customPoint")} ({fmtCoord(customB.lat)}°, {fmtCoord(customB.lon)}°)
                </option>
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
                {customB ? ` · ${t("customPoint")}` : ""}
              </span>
            )}
          </label>
          <label className="block text-xs text-white/55">
            {t("startUtc")}
            <input
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block text-xs text-white/55">
            {t("endUtc")}
            <input
              className="mt-1 w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || samePoint}
            onClick={runCompare}
            className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-50"
          >
            {busy ? (customA || customB ? t("comparingLive") : t("comparing")) : t("compareSites")}
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
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
        />
      )}
      <ReportHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
