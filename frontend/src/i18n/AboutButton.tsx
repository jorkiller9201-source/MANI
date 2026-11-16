"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "./I18nProvider";
import { API_REFS, METHOD_REFS, SI_REFS, type AboutRef } from "./aboutRefs";
import {
  GLOSSARY_CATEGORIES,
  glossaryDefKey,
  glossaryTermKey,
} from "./aboutGlossary";

type AboutTab = "overview" | "glossary";

function RefList({ items, t }: { items: AboutRef[]; t: (key: string) => string }) {
  return (
    <ul className="mt-1 space-y-1.5">
      {items.map((r) => (
        <li key={r.id} className="leading-snug">
          <a
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7ec8ff] underline decoration-white/25 underline-offset-2 hover:decoration-[#7ec8ff]"
          >
            {t(r.labelKey)}
          </a>
          <span className="ml-1 break-all text-[10px] text-white/35">{r.href}</span>
        </li>
      ))}
    </ul>
  );
}

function tabBtnClass(active: boolean): string {
  const base =
    "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3";
  return active
    ? `${base} border-[#f2d27a]/50 bg-[#f2d27a]/15 text-[#f2d27a]`
    : `${base} border-white/15 bg-white/5 text-white/65 hover:border-white/25 hover:text-white/85`;
}

export default function AboutButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AboutTab>("overview");
  const titleId = useId();
  const tablistId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setTab("overview");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-white/20 px-3 py-1.5 text-white"
        suppressHydrationWarning
      >
        {t("about")}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(4, 8, 16, 0.72)" }}
          onClick={close}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/15 bg-[#0b1f3a] p-5 text-sm text-white/85 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold text-[#f2d27a]">
                {t("aboutTitle")}
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded border border-white/20 px-2 py-1 text-xs text-white/70"
              >
                {t("aboutClose")}
              </button>
            </div>

            <div
              id={tablistId}
              role="tablist"
              aria-label={t("aboutTitle")}
              className="mb-4 flex flex-wrap gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "overview"}
                aria-controls="about-panel-overview"
                id="about-tab-overview"
                className={tabBtnClass(tab === "overview")}
                onClick={() => setTab("overview")}
              >
                {t("aboutTabOverview")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "glossary"}
                aria-controls="about-panel-glossary"
                id="about-tab-glossary"
                className={tabBtnClass(tab === "glossary")}
                onClick={() => setTab("glossary")}
              >
                {t("aboutTabGlossary")}
              </button>
            </div>

            {tab === "overview" ? (
              <div id="about-panel-overview" role="tabpanel" aria-labelledby="about-tab-overview">
                <section className="space-y-2 border-b border-white/10 pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutWhyTitle")}
                  </h3>
                  <p className="leading-relaxed">{t("aboutWhyBody")}</p>
                </section>

                <section className="space-y-2 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutHowTitle")}
                  </h3>
                  <p className="leading-relaxed">{t("aboutHowBody")}</p>
                  <p className="leading-relaxed text-white/70">{t("aboutHowGeo")}</p>
                  <p className="leading-relaxed text-white/70">{t("aboutHowScore")}</p>
                </section>

                <section className="space-y-1 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutRefsTitle")}
                  </h3>
                  <p className="text-[11px] text-white/45">{t("aboutRefsLead")}</p>
                  <RefList items={METHOD_REFS} t={t} />
                </section>

                <section className="space-y-1 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutApisTitle")}
                  </h3>
                  <p className="text-[11px] text-white/45">{t("aboutApisLead")}</p>
                  <RefList items={API_REFS} t={t} />
                </section>

                <section className="space-y-1 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutSiTitle")}
                  </h3>
                  <p className="leading-relaxed">{t("aboutSiNote")}</p>
                  <RefList items={SI_REFS} t={t} />
                </section>

                <section className="space-y-2 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutRepoTitle")}
                  </h3>
                  <p className="text-[11px] text-white/45">{t("aboutRepoLead")}</p>
                  <p className="leading-snug">
                    <a
                      href="https://github.com/jorkiller9201-source/MANI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7ec8ff] underline decoration-white/25 underline-offset-2 hover:decoration-[#7ec8ff]"
                    >
                      {t("aboutRepoLink")}
                    </a>
                    <span className="ml-1 break-all text-[10px] text-white/35">
                      https://github.com/jorkiller9201-source/MANI
                    </span>
                  </p>
                </section>

                <section className="space-y-2 border-b border-white/10 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutDeliverablesTitle")}
                  </h3>
                  <p className="leading-relaxed text-white/75">{t("aboutDeliverablesBody")}</p>
                </section>

                <section className="space-y-2 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {t("aboutTeamTitle")}
                  </h3>
                  <p className="leading-relaxed">{t("aboutTeamAndre")}</p>
                  <p className="leading-relaxed">
                    <a
                      href="https://www.instagram.com/astroandre_hn/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7ec8ff] underline decoration-white/25 underline-offset-2 hover:decoration-[#7ec8ff]"
                    >
                      {t("aboutAndreIg")}
                    </a>
                  </p>
                  <p className="leading-relaxed text-white/75">{t("aboutTeamBody")}</p>
                </section>
              </div>
            ) : (
              <div id="about-panel-glossary" role="tabpanel" aria-labelledby="about-tab-glossary">
                <p className="mb-4 text-[13px] leading-relaxed text-white/70">{t("aboutGlossaryLead")}</p>
                {GLOSSARY_CATEGORIES.map((cat) => (
                  <section
                    key={cat.catKey}
                    className="border-b border-white/10 py-3 last:border-b-0"
                  >
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                      {t(cat.catKey)}
                    </h3>
                    <dl className="space-y-2.5">
                      {cat.termIds.map((id) => (
                        <div key={id}>
                          <dt className="font-medium text-[#f2d27a]">{t(glossaryTermKey(id))}</dt>
                          <dd className="mt-0.5 text-[13px] leading-relaxed text-white/75">
                            {t(glossaryDefKey(id))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}