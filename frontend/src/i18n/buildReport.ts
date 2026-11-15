import type { CompareResult } from "@/lib/api";
import type { LangCode } from "./languages";
import { t } from "./translations";

function siteLocation(block: CompareResult["a"]) {
  const loc = block.location;
  const lat = loc?.lat ?? block.site.lat;
  const lon = loc?.lon ?? block.site.lon;
  const coord = loc?.horizons_site_coord ?? `${lon},${lat},${loc?.elev_km ?? block.site.elev_km ?? 0}`;
  return { lat, lon, coord };
}

/** Build the one-page report in the selected UI language from compare metrics. */
export function buildLocalizedReport(lang: LangCode, result: CompareResult): string {
  const line = (labelKey: "labelA" | "labelB", block: CompareResult["a"]) => {
    const { lat, lon, coord } = siteLocation(block);
    const sunTopo = block.sun.hours_above_topo_horizon ?? block.sun.hours_above_horizon;
    const earthTopo = block.earth.hours_above_topo_horizon ?? block.earth.hours_above_horizon;
    return [
      t(lang, "reportSiteLine", {
        label: t(lang, labelKey),
        name: block.site.name,
        sunH: block.sun.hours_above_horizon,
        sunE: block.sun.mean_elevation_deg ?? "—",
        earthH: block.earth.hours_above_horizon,
        earthE: block.earth.mean_elevation_deg ?? "—",
        score: block.score,
      }),
      t(lang, "reportSiteTopoLine", {
        sunTopo,
        earthTopo,
        scoreTopo: block.score,
        scoreGeom: block.score_geometric ?? "—",
      }),
      t(lang, "reportLocation", { lat, lon, coord }),
    ].join("\n");
  };

  const lines = [
    t(lang, "reportHeading"),
    `${t(lang, "reportWindow")}: ${result.window.start} → ${result.window.end}`,
    "",
    line("labelA", result.a),
    "",
    line("labelB", result.b),
    "",
    t(lang, "geoCrossNote"),
    "",
    t(lang, "reportRec", { winner: result.winner_name }),
    "",
    t(lang, "reportSources"),
    `- ${t(lang, "reportEphemeris")}`,
    `- ${t(lang, "reportLola")}`,
    `- ${t(lang, "reportTerrain")}`,
    "",
    t(lang, "reportNote"),
  ];

  return lines.join("\n");
}
