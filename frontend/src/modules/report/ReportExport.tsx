"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompareResult } from "@/lib/api";
import { reportsApi } from "@/lib/api";
import { buildLocalizedReport } from "@/i18n/buildReport";
import { useI18n } from "@/i18n/I18nProvider";
import { LANGUAGES, type LangCode } from "@/i18n/languages";
import { t as translate } from "@/i18n/translations";
import { captureCompareMapSnapshot, mapSnapshotLooksBlank } from "@/modules/moon/captureMap";
import ReportSheet from "./ReportSheet";

function buildReportLabels(lang: LangCode) {
  return {
    title: translate(lang, "exportTitle"),
    tagline: translate(lang, "appTitle"),
    queriedAt: translate(lang, "exportQueriedAt"),
    printedAt: translate(lang, "exportPrintedAt"),
    windowFrom: translate(lang, "exportWindowFrom"),
    windowTo: translate(lang, "exportWindowTo"),
    recommendation: translate(lang, "recommendation"),
    location: translate(lang, "location"),
    elevLola: translate(lang, "elevLolaKm"),
    sunTopo: translate(lang, "sunHoursTopo"),
    earthTopo: translate(lang, "earthHoursTopo"),
    sunGeom: translate(lang, "sunHours"),
    earthGeom: translate(lang, "earthHours"),
    score: translate(lang, "score"),
    scoreGeom: translate(lang, "scoreGeometric"),
    sources: translate(lang, "sources"),
    team: translate(lang, "exportTeam"),
    confidential: translate(lang, "exportStamp"),
    annexA: translate(lang, "exportAnnexA"),
    annexALead: translate(lang, "exportAnnexALead"),
    annexAMissing: translate(lang, "exportAnnexAMissing"),
    annexACaption: translate(lang, "exportAnnexACaption"),
    timelineSection: translate(lang, "exportTimelineSection"),
    timelineLead: translate(lang, "exportTimelineLead"),
    timelineOptionA: translate(lang, "exportTimelineOptionA"),
    timelineOptionB: translate(lang, "exportTimelineOptionB"),
    timelineLegendSun: translate(lang, "exportTimelineLegendSun"),
    timelineLegendEarth: translate(lang, "exportTimelineLegendEarth"),
    timelineAxisHours: translate(lang, "exportTimelineAxisHours"),
    timelineEmpty: translate(lang, "exportTimelineEmpty"),
  };
}

const PRINT_DOC_BASE = "MANI — Moon Analysis & Navigation Intelligent";

/** Local YYYY-MM-DD-HHMM for default Save-as-PDF filename (browser uses document.title). */
function printFilenameTimestamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}-${h}${min}`;
}

function printWithTimestampedTitle(at: Date) {
  const prev = document.title;
  document.title = `${PRINT_DOC_BASE} ${printFilenameTimestamp(at)}`;
  const restore = () => {
    document.title = prev;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

function formatLocal(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function pointFromBlock(block: CompareResult["a"]) {
  return {
    lat: block.location?.lat ?? block.site.lat,
    lon: block.location?.lon ?? block.site.lon,
    name: block.site.name,
  };
}

export default function ReportExport({
  open,
  onClose,
  result,
  reportText,
  queriedAt,
  onSaved,
  initialMapImage,
  fromHistory,
  reportId,
  reportCreatedAt,
  onMapImageRepaired,
}: {
  open: boolean;
  onClose: () => void;
  result: CompareResult;
  reportText: string;
  queriedAt: string;
  onSaved?: () => void;
  /** Annex A snapshot from history — language-independent */
  initialMapImage?: string | null;
  /** Mis informes: pick report language and reprint without saving again */
  fromHistory?: boolean;
  reportId?: number;
  /** Saved report created_at (ISO) — PDF filename stamp when reprinting */
  reportCreatedAt?: string;
  /** Persist a one-time live-globe repair for an old save */
  onMapImageRepaired?: (id: number, mapImage: string) => void;
}) {
  const { lang, t } = useI18n();
  const [reportLang, setReportLang] = useState<LangCode>(lang);
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const annexRepairAttempted = useRef(false);
  const onMapImageRepairedRef = useRef(onMapImageRepaired);
  onMapImageRepairedRef.current = onMapImageRepaired;

  useEffect(() => {
    if (!open) {
      annexRepairAttempted.current = false;
      return;
    }
    setPrintedAt(new Date().toISOString());
    setError("");
    setSavedId(null);
  }, [open]);

  useEffect(() => {
    if (open && fromHistory) setReportLang(lang);
  }, [open, fromHistory, lang]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const mapA = pointFromBlock(result.a);
    const mapB = pointFromBlock(result.b);

    async function usableStored(dataUrl: string | null | undefined) {
      if (!dataUrl) return null;
      return (await mapSnapshotLooksBlank(dataUrl)) ? null : dataUrl;
    }

    async function resolveAnnexImage() {
      if (fromHistory) {
        const stored = await usableStored(initialMapImage);
        if (cancelled) return;
        if (stored) {
          setMapImage(stored);
          setMapBusy(false);
          return;
        }
        if (annexRepairAttempted.current) {
          setMapBusy(false);
          return;
        }
        setMapBusy(true);
        setMapImage(null);
        annexRepairAttempted.current = true;
        const snap = await captureCompareMapSnapshot(mapA, mapB);
        if (cancelled) return;
        if (snap) {
          setMapImage(snap);
          if (reportId != null) onMapImageRepairedRef.current?.(reportId, snap);
        }
        setMapBusy(false);
        return;
      }

      setMapBusy(true);
      setMapImage(null);
      const snap = await captureCompareMapSnapshot(mapA, mapB);
      if (!cancelled) {
        setMapImage(snap);
        setMapBusy(false);
      }
    }

    void resolveAnnexImage();
    return () => {
      cancelled = true;
    };
  }, [open, fromHistory, initialMapImage, result, reportId]);

  const sheetLang = fromHistory ? reportLang : lang;
  const effectiveReportText = useMemo(
    () => (fromHistory ? buildLocalizedReport(reportLang, result) : reportText),
    [fromHistory, reportLang, result, reportText]
  );
  const labels = useMemo(() => buildReportLabels(sheetLang), [sheetLang]);

  if (!open) return null;

  function reprintOnly() {
    const now = new Date().toISOString();
    setPrintedAt(now);
    const filenameAt = reportCreatedAt ? new Date(reportCreatedAt) : new Date(now);
    requestAnimationFrame(() => {
      setTimeout(() => printWithTimestampedTitle(filenameAt), 120);
    });
  }

  async function saveAndPrint() {
    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    setPrintedAt(now);
    try {
      const mapA = pointFromBlock(result.a);
      const mapB = pointFromBlock(result.b);
      let snap = mapImage;
      if (!snap || (await mapSnapshotLooksBlank(snap))) {
        snap = await captureCompareMapSnapshot(mapA, mapB);
        setMapImage(snap);
      }
      if (!snap) {
        setError(t("exportAnnexMissing"));
        return;
      }
      const title = `${result.a.site.name} vs ${result.b.site.name}`;
      const saved = await reportsApi.save({
        title,
        winner_name: result.winner_name,
        window_start: result.window.start,
        window_end: result.window.end,
        queried_at: queriedAt,
        payload: {
          ...result,
          _meta: {
            queried_at: queriedAt,
            printed_at: now,
            report_text: reportText,
            map_image: snap || null,
          },
        },
      });
      setSavedId(saved.id);
      onSaved?.();
      requestAnimationFrame(() => {
        setTimeout(() => printWithTimestampedTitle(new Date(now)), 120);
      });
    } catch (e: any) {
      setError(e.message || t("exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mani-export no-print-chrome" role="dialog" aria-modal="true">
      <div className="mani-export__backdrop" onClick={onClose} />
      <div className="mani-export__panel">
        <div className="mani-export__toolbar no-print">
          <div>
            <h2 className="mani-export__toolbar-title">{t("exportPreview")}</h2>
            <p className="mani-export__toolbar-sub">
              {mapBusy
                ? t("exportAnnexCapturing")
                : fromHistory
                  ? t("exportReprintLead")
                  : t("exportPreviewLead")}
            </p>
          </div>
          <div className="mani-export__actions">
            {fromHistory && (
              <div className="mani-lang mani-export__lang">
                <span id="mani-export-report-lang" className="mani-lang__label">
                  {t("exportReportLanguage")}
                </span>
                <select
                  aria-labelledby="mani-export-report-lang"
                  className="mani-lang__select"
                  value={reportLang}
                  onChange={(e) => setReportLang(e.target.value as LangCode)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className="mani-export__btn ghost" onClick={onClose}>
              {t("aboutClose")}
            </button>
            <button
              type="button"
              className="mani-export__btn primary"
              disabled={busy || mapBusy}
              onClick={fromHistory ? reprintOnly : saveAndPrint}
            >
              {busy ? t("exportSaving") : fromHistory ? t("exportReprint") : t("exportPrint")}
            </button>
          </div>
        </div>
        {error && <p className="mani-export__error no-print">{error}</p>}
        {savedId != null && (
          <p className="mani-export__ok no-print">
            {t("exportSaved", { id: savedId })}
          </p>
        )}
        <div className="mani-export__scroll">
          <ReportSheet
            result={result}
            reportText={effectiveReportText}
            queriedAt={formatLocal(queriedAt)}
            printedAt={formatLocal(printedAt)}
            labels={labels}
            mapImage={mapImage}
          />
        </div>
      </div>
    </div>
  );
}
