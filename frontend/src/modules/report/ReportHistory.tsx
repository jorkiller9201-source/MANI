"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompareResult, SavedReportSummary } from "@/lib/api";
import { reportsApi } from "@/lib/api";
import { guestReports } from "@/lib/guestStorage";
import { useI18n } from "@/i18n/I18nProvider";
import ReportExport from "./ReportExport";

export default function ReportHistory({
  open,
  onClose,
  guestMode = false,
}: {
  open: boolean;
  onClose: () => void;
  guestMode?: boolean;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<SavedReportSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replay, setReplay] = useState<{
    id: number;
    result: CompareResult;
    reportText: string;
    queriedAt: string;
    createdAt: string;
    mapImage?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (guestMode) {
        setRows(guestReports.list());
      } else {
        const r = await reportsApi.list();
        setRows(r.reports);
      }
    } catch (e: any) {
      setError(e.message || t("historyFailed"));
    } finally {
      setBusy(false);
    }
  }, [t, guestMode]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const persistRepairedMap = useCallback(
    async (id: number, map_image: string) => {
      try {
        if (guestMode) {
          guestReports.patchMapImage(id, map_image);
        } else {
          await reportsApi.patchMapImage(id, map_image);
        }
        setReplay((prev) => (prev?.id === id ? { ...prev, mapImage: map_image } : prev));
      } catch {
        /* preview still shows repaired snap; next open may retry patch */
      }
    },
    [guestMode]
  );

  if (!open) return null;

  async function openReport(id: number) {
    try {
      const d = guestMode ? guestReports.get(id) : await reportsApi.get(id);
      if (!d) {
        setError(t("historyFailed"));
        return;
      }
      const payload = d.payload;
      const { _meta, ...rest } = payload as CompareResult & {
        _meta?: { report_text?: string; queried_at?: string; map_image?: string | null };
      };
      setReplay({
        id: d.id,
        result: rest as CompareResult,
        reportText: _meta?.report_text || payload.report_en || "",
        queriedAt: _meta?.queried_at || d.queried_at,
        createdAt: d.created_at,
        mapImage: _meta?.map_image ?? null,
      });
    } catch (e: any) {
      setError(e.message || t("historyFailed"));
    }
  }

  async function remove(id: number) {
    try {
      if (guestMode) {
        guestReports.remove(id);
      } else {
        await reportsApi.remove(id);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message || t("historyFailed"));
    }
  }

  return (
    <>
      <div className="mani-history" role="dialog" aria-modal="true">
        <div className="mani-history__backdrop" onClick={onClose} />
        <aside className="mani-history__panel">
          <div className="mani-history__head">
            <div>
              <h2>{t("historyTitle")}</h2>
              <p>{guestMode ? t("guestHistoryLead") : t("historyLead")}</p>
            </div>
            <button type="button" className="mani-export__btn ghost" onClick={onClose}>
              {t("aboutClose")}
            </button>
          </div>
          {busy && <p className="text-sm text-white/50">{t("historyLoading")}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!busy && rows.length === 0 && (
            <p className="mani-history__empty">{t("historyEmpty")}</p>
          )}
          <ul className="mani-history__list">
            {rows.map((r) => (
              <li key={r.id} className="mani-history__item">
                <button type="button" className="mani-history__main" onClick={() => openReport(r.id)}>
                  <strong>{r.title}</strong>
                  <span>
                    {t("recommendation")} {r.winner_name || "—"}
                  </span>
                  <span className="mani-history__meta">
                    {t("exportQueriedAt")}: {new Date(r.queried_at).toLocaleString()} ·{" "}
                    {t("historySaved")}: {new Date(r.created_at).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="mani-history__del"
                  onClick={() => remove(r.id)}
                  aria-label={t("historyDelete")}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      {replay && (
        <ReportExport
          open
          fromHistory
          guestMode={guestMode}
          reportId={replay.id}
          reportCreatedAt={replay.createdAt}
          onClose={() => setReplay(null)}
          result={replay.result}
          reportText={replay.reportText}
          queriedAt={replay.queriedAt}
          initialMapImage={replay.mapImage}
          onMapImageRepaired={persistRepairedMap}
          onSaved={load}
        />
      )}
    </>
  );
}
