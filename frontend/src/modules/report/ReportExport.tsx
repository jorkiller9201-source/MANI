"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompareResult } from "@/lib/api";
import { reportsApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { captureCompareMapSnapshot } from "@/modules/moon/captureMap";
import ReportSheet from "./ReportSheet";

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
}: {
  open: boolean;
  onClose: () => void;
  result: CompareResult;
  reportText: string;
  queriedAt: string;
  onSaved?: () => void;
  /** When reopening from history, reuse stored Annex A image */
  initialMapImage?: string | null;
}) {
  const { t } = useI18n();
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(initialMapImage ?? null);
  const [mapBusy, setMapBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrintedAt(new Date().toISOString());
    setError("");
    setSavedId(null);

    if (initialMapImage) {
      setMapImage(initialMapImage);
      return;
    }

    let cancelled = false;
    setMapBusy(true);
    setMapImage(null);
    (async () => {
      const snap = await captureCompareMapSnapshot(pointFromBlock(result.a), pointFromBlock(result.b));
      if (!cancelled) {
        setMapImage(snap);
        setMapBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, result, initialMapImage]);

  const labels = useMemo(
    () => ({
      title: t("exportTitle"),
      tagline: t("appTitle"),
      queriedAt: t("exportQueriedAt"),
      printedAt: t("exportPrintedAt"),
      windowFrom: t("exportWindowFrom"),
      windowTo: t("exportWindowTo"),
      recommendation: t("recommendation"),
      location: t("location"),
      elevLola: t("elevLolaKm"),
      sunTopo: t("sunHoursTopo"),
      earthTopo: t("earthHoursTopo"),
      sunGeom: t("sunHours"),
      earthGeom: t("earthHours"),
      score: t("score"),
      scoreGeom: t("scoreGeometric"),
      sources: t("sources"),
      team: t("exportTeam"),
      confidential: t("exportStamp"),
      annexA: t("exportAnnexA"),
      annexALead: t("exportAnnexALead"),
      annexAMissing: t("exportAnnexAMissing"),
      annexACaption: t("exportAnnexACaption"),
      timelineSection: t("exportTimelineSection"),
      timelineLead: t("exportTimelineLead"),
      timelineOptionA: t("exportTimelineOptionA"),
      timelineOptionB: t("exportTimelineOptionB"),
      timelineLegendSun: t("exportTimelineLegendSun"),
      timelineLegendEarth: t("exportTimelineLegendEarth"),
      timelineAxisHours: t("exportTimelineAxisHours"),
      timelineEmpty: t("exportTimelineEmpty"),
    }),
    [t]
  );

  if (!open) return null;

  async function saveAndPrint() {
    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    setPrintedAt(now);
    try {
      let snap = mapImage;
      if (!snap && !initialMapImage) {
        snap = await captureCompareMapSnapshot(pointFromBlock(result.a), pointFromBlock(result.b));
        setMapImage(snap);
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
        setTimeout(() => window.print(), 120);
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
              {mapBusy ? t("exportAnnexCapturing") : t("exportPreviewLead")}
            </p>
          </div>
          <div className="mani-export__actions">
            <button type="button" className="mani-export__btn ghost" onClick={onClose}>
              {t("aboutClose")}
            </button>
            <button
              type="button"
              className="mani-export__btn primary"
              disabled={busy || mapBusy}
              onClick={saveAndPrint}
            >
              {busy ? t("exportSaving") : t("exportPrint")}
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
            reportText={reportText}
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
