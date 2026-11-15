"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type AdminActivityRow,
  type AdminSiteMetrics,
  type AdminSummary,
  type AdminUserRow,
} from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

type Tab = "summary" | "users" | "activity" | "sites";

const ACTION_FILTERS = ["", "login", "login_google", "login_guest", "compare", "report_save"] as const;

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-white/10 bg-black/35 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-[#f2d27a]">{value}</div>
    </div>
  );
}

export default function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [events, setEvents] = useState<AdminActivityRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [metrics, setMetrics] = useState<AdminSiteMetrics | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [s, u, a, m] = await Promise.all([
        adminApi.summary(),
        adminApi.users(100, 0),
        adminApi.activity({ limit: 50, action: actionFilter || undefined }),
        adminApi.siteMetrics(30),
      ]);
      setSummary(s);
      setUsers(u.users);
      setUsersTotal(u.total);
      setEvents(a.events);
      setEventsTotal(a.total);
      setMetrics(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("adminFailed"));
    } finally {
      setBusy(false);
    }
  }, [t, actionFilter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "summary", label: t("adminTabSummary") },
    { id: "users", label: t("adminTabUsers") },
    { id: "activity", label: t("adminTabActivity") },
    { id: "sites", label: t("adminTabSites") },
  ];

  return (
    <div className="mani-history" role="dialog" aria-modal="true" aria-label={t("adminTitle")}>
      <div className="mani-history__backdrop" onClick={onClose} />
      <aside className="mani-history__panel" style={{ maxWidth: "42rem", width: "min(42rem, 100%)" }}>
        <div className="mani-history__head">
          <div>
            <h2>{t("adminTitle")}</h2>
            <p>{t("adminLead")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="mani-export__btn ghost" onClick={load} disabled={busy}>
              {t("adminRefresh")}
            </button>
            <button type="button" className="mani-export__btn ghost" onClick={onClose}>
              {t("aboutClose")}
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className={`rounded px-2.5 py-1 text-xs sm:text-sm ${
                tab === tb.id
                  ? "bg-[#f2d27a]/20 text-[#f2d27a]"
                  : "border border-white/15 text-white/70 hover:text-white"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {busy && <p className="text-sm text-white/50">{t("adminLoading")}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}

        {!busy && tab === "summary" && summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label={t("adminUsersTotal")} value={summary.users_total} />
            <Kpi label={t("adminUsersActive")} value={summary.users_active} />
            <Kpi label={t("adminLogins7d")} value={summary.logins_7d} />
            <Kpi label={t("adminCompares7d")} value={summary.compares_7d} />
            <Kpi label={t("adminCompares30d")} value={summary.compares_30d} />
            <Kpi label={t("adminGuestCompares7d")} value={summary.guest_compares_7d} />
            <Kpi label={t("adminReportsTotal")} value={summary.reports_total} />
            <Kpi label={t("adminReports7d")} value={summary.reports_7d} />
            <Kpi label={t("adminUniqueActive7d")} value={summary.unique_active_users_7d} />
            <div className="col-span-2 rounded border border-white/10 bg-black/35 px-3 py-2 sm:col-span-3">
              <div className="text-[10px] uppercase tracking-wide text-white/45">
                {t("adminByProvider")}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-white">
                {Object.entries(summary.users_by_provider).map(([k, v]) => (
                  <span key={k}>
                    {k}: <strong className="text-[#f2d27a]">{v}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!busy && tab === "users" && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-white/45">
              {t("adminUsersCount").replace("{n}", String(usersTotal))}
            </p>
            {users.length === 0 ? (
              <p className="mani-history__empty">{t("adminEmpty")}</p>
            ) : (
              <table className="w-full min-w-[36rem] border-collapse text-left text-xs text-white/85">
                <thead>
                  <tr className="border-b border-white/15 text-[10px] uppercase tracking-wide text-white/45">
                    <th className="py-1.5 pr-2">{t("adminColEmail")}</th>
                    <th className="py-1.5 pr-2">{t("adminColRole")}</th>
                    <th className="py-1.5 pr-2">{t("adminColProvider")}</th>
                    <th className="py-1.5 pr-2">{t("adminColCompares")}</th>
                    <th className="py-1.5 pr-2">{t("adminColReports")}</th>
                    <th className="py-1.5">{t("adminColLastLogin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/8">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium text-white">{u.email}</div>
                        {u.full_name && <div className="text-white/45">{u.full_name}</div>}
                      </td>
                      <td className="py-1.5 pr-2">{u.role || "—"}</td>
                      <td className="py-1.5 pr-2">{u.auth_provider}</td>
                      <td className="py-1.5 pr-2">{u.compare_count}</td>
                      <td className="py-1.5 pr-2">{u.reports_count}</td>
                      <td className="py-1.5">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!busy && tab === "activity" && (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-white/50" htmlFor="admin-action-filter">
                {t("adminFilterAction")}
              </label>
              <select
                id="admin-action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded border border-white/20 bg-black/50 px-2 py-1 text-xs text-white"
              >
                {ACTION_FILTERS.map((a) => (
                  <option key={a || "all"} value={a}>
                    {a || t("adminFilterAll")}
                  </option>
                ))}
              </select>
              <span className="text-xs text-white/40">
                {t("adminActivityCount").replace("{n}", String(eventsTotal))}
              </span>
            </div>
            {events.length === 0 ? (
              <p className="mani-history__empty">{t("adminEmpty")}</p>
            ) : (
              <ul className="mani-history__list">
                {events.map((ev) => (
                  <li key={ev.id} className="mani-history__item">
                    <div className="mani-history__main" style={{ cursor: "default" }}>
                      <strong>
                        {ev.action}
                        {ev.is_guest ? ` · ${t("guestLabel")}` : ""}
                      </strong>
                      <span>
                        {ev.user_email || (ev.is_guest ? t("guestLabel") : "—")}
                      </span>
                      <span className="mani-history__meta">
                        {new Date(ev.created_at).toLocaleString()}
                        {ev.detail
                          ? ` · ${JSON.stringify(ev.detail).slice(0, 120)}${
                              JSON.stringify(ev.detail).length > 120 ? "…" : ""
                            }`
                          : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!busy && tab === "sites" && metrics && (
          <div className="space-y-4 text-xs text-white/85">
            <p className="text-white/45">
              {t("adminMetricsWindow").replace("{n}", String(metrics.window_days))}
            </p>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[#f2d27a]">
                {t("adminTopSitesCompares")}
              </h3>
              {metrics.top_sites_by_compares.length === 0 ? (
                <p className="text-white/40">{t("adminEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.top_sites_by_compares.map((s) => (
                    <li key={s.site_key} className="flex justify-between gap-2 border-b border-white/8 py-1">
                      <span>{s.label}</span>
                      <span className="shrink-0 text-white/55">
                        {s.compare_count} · {t("adminWins")}: {s.win_count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[#f2d27a]">
                {t("adminTopSitesScore")}
              </h3>
              {metrics.top_sites_by_avg_score.length === 0 ? (
                <p className="text-white/40">{t("adminEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.top_sites_by_avg_score.map((s) => (
                    <li key={s.site_key} className="flex justify-between gap-2 border-b border-white/8 py-1">
                      <span>{s.label}</span>
                      <span className="shrink-0 text-white/55">
                        avg {s.avg_score.toFixed(1)} · max {s.max_score.toFixed(1)} (n=
                        {s.sample_n})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[#f2d27a]">
                {t("adminTopWinners")}
              </h3>
              {metrics.top_winners.length === 0 ? (
                <p className="text-white/40">{t("adminEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.top_winners.map((w) => (
                    <li key={w.name} className="flex justify-between gap-2 border-b border-white/8 py-1">
                      <span>{w.name}</span>
                      <span className="text-white/55">{w.wins}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[#f2d27a]">
                {t("adminComparesByDay")}
              </h3>
              {metrics.compares_by_day.length === 0 ? (
                <p className="text-white/40">{t("adminEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.compares_by_day.map((d) => (
                    <li key={d.day} className="flex justify-between gap-2 border-b border-white/8 py-1">
                      <span>{d.day}</span>
                      <span className="text-white/55">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[#f2d27a]">
                {t("adminScoreByWindow")}
              </h3>
              {metrics.score_by_window.length === 0 ? (
                <p className="text-white/40">{t("adminEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {metrics.score_by_window.map((w, i) => (
                    <li
                      key={`${w.window_start}-${w.window_end}-${i}`}
                      className="border-b border-white/8 py-1"
                    >
                      <div className="font-medium text-white">
                        {w.winner_name || "—"}{" "}
                        <span className="font-normal text-white/45">×{w.n}</span>
                      </div>
                      <div className="text-white/45">
                        {w.window_start} → {w.window_end}
                        {w.score_a != null || w.score_b != null
                          ? ` · A ${w.score_a?.toFixed(1) ?? "—"} / B ${w.score_b?.toFixed(1) ?? "—"}`
                          : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
