/** Glossary structure for About → Terms tab (labels via i18n keys). */

export type GlossaryCategory = {
  catKey: string;
  termIds: string[];
};

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  {
    catKey: "glossaryCatMission",
    termIds: ["mission_mani", "mission_clps", "mission_artemis", "mission_landing", "mission_space_apps"],
  },
  {
    catKey: "glossaryCatSites",
    termIds: [
      "sites_a_b",
      "sites_curated",
      "sites_custom",
      "site_shackleton",
      "site_malapert",
      "site_de_gerlache",
      "site_connecting_ridge",
      "site_nobile",
      "site_haworth",
    ],
  },
  {
    catKey: "glossaryCatMap",
    termIds: ["map_pole", "map_coords", "map_moon_trek", "map_cesium", "map_lola_relief", "map_layers"],
  },
  {
    catKey: "glossaryCatTime",
    termIds: ["time_utc", "time_window", "time_ephemeris", "time_sky_epoch"],
  },
  {
    catKey: "glossaryCatSky",
    termIds: [
      "sky_sun",
      "sky_earth",
      "sky_horizon_geom",
      "sky_horizon_topo",
      "sky_azimuth",
      "sky_elevation",
      "sky_clearing",
      "sky_mask",
    ],
  },
  {
    catKey: "glossaryCatMetrics",
    termIds: [
      "metrics_compare",
      "metrics_score",
      "metrics_geom_hours",
      "metrics_topo_hours",
      "metrics_recommendation",
      "metrics_mean_elev",
      "metrics_until_set",
    ],
  },
  {
    catKey: "glossaryCatData",
    termIds: ["data_horizons", "data_lola", "data_ldem", "data_lro", "data_pds", "data_offline"],
  },
  {
    catKey: "glossaryCatReport",
    termIds: [
      "report_one_page",
      "report_annex_a",
      "report_timeline",
      "report_export",
      "report_history",
      "team_si",
    ],
  },
];

export function glossaryTermKey(id: string): string {
  return `glossaryTerm_${id}`;
}

export function glossaryDefKey(id: string): string {
  return `glossaryDef_${id}`;
}

export const GLOSSARY_TERM_COUNT = GLOSSARY_CATEGORIES.reduce((n, c) => n + c.termIds.length, 0);