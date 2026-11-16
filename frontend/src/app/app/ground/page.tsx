"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

const SiteGroundView = dynamic(() => import("@/modules/ground/SiteGroundView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#05080c] px-8 text-sm text-white/70">
      <p>Loading lunar terrain…</p>
      <div className="h-2.5 w-64 max-w-full overflow-hidden rounded-sm bg-white/10">
        <div className="h-full w-[12%] rounded-sm bg-[#f2d27a]" />
      </div>
      <p className="font-mono text-xs text-white/50">0%</p>
    </div>
  ),
});

function parseSlot(raw: string | null): "a" | "b" {
  return raw?.toLowerCase() === "b" ? "b" : "a";
}

function GroundPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const slot = parseSlot(sp.get("slot"));
  const name = sp.get("name")?.trim() || (slot === "a" ? t("siteA") : t("siteB"));
  const siteId = sp.get("siteId")?.trim() || null;
  const elevKmRaw = Number(sp.get("elevKm"));
  const elevKm = Number.isFinite(elevKmRaw) ? elevKmRaw : 0;
  const startIso = sp.get("start") || sp.get("t0") || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const endIso =
    sp.get("end") ||
    new Date(new Date(startIso.replace("Z", "+00:00")).getTime() + 14 * 86400_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");

  const valid = Number.isFinite(lat) && Number.isFinite(lon);

  function onClose() {
    window.close();
    // If the browser blocks close (tab not script-opened), return to compare.
    window.setTimeout(() => {
      if (!window.closed) router.push("/app");
    }, 150);
  }

  if (!valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#071018] px-4 text-center text-white">
        <p className="text-sm text-white/70">{t("groundMissingParams")}</p>
        <button
          type="button"
          className="mani-export__btn ghost"
          onClick={() => router.push("/app")}
        >
          {t("groundBackToApp")}
        </button>
      </div>
    );
  }

  return (
    <SiteGroundView
      open
      variant="page"
      onClose={onClose}
      closeLabel={t("groundCloseTab")}
      slot={slot}
      name={name}
      lat={lat}
      lon={lon}
      siteId={siteId}
      elevKm={elevKm}
      startIso={startIso}
      endIso={endIso}
    />
  );
}

export default function GroundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#05080c] px-8 text-sm text-white/70">
          <p>Loading lunar terrain…</p>
          <div className="h-2.5 w-64 max-w-full overflow-hidden rounded-sm bg-white/10">
            <div className="h-full w-[8%] rounded-sm bg-[#f2d27a]" />
          </div>
          <p className="font-mono text-xs text-white/50">0%</p>
        </div>
      }
    >
      <GroundPageInner />
    </Suspense>
  );
}
