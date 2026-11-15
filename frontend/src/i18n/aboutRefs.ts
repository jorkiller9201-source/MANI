/** Official NASA / project references shown in About (URLs stay language-neutral). */

export type AboutRef = {
  id: string;
  /** Translation key for the link label */
  labelKey: string;
  href: string;
};

/** Method & science / official docs (calculations rooted in Horizons observer tables). */
export const METHOD_REFS: AboutRef[] = [
  {
    id: "horizons",
    labelKey: "refHorizonsSystem",
    href: "https://ssd.jpl.nasa.gov/horizons/",
  },
  {
    id: "horizons-api-doc",
    labelKey: "refHorizonsApiDoc",
    href: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
  },
  {
    id: "horizons-manual",
    labelKey: "refHorizonsManual",
    href: "https://ssd.jpl.nasa.gov/horizons/manual.html",
  },
  {
    id: "moon-trek",
    labelKey: "refMoonTrek",
    href: "https://trek.nasa.gov/moon/",
  },
  {
    id: "lola-gdr",
    labelKey: "refLolaGdr",
    href: "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG",
  },
  {
    id: "barker-2021",
    labelKey: "refBarker2021",
    href: "https://doi.org/10.1016/j.pss.2020.105119",
  },
  {
    id: "clps",
    labelKey: "refClps",
    href: "https://www.nasa.gov/commercial-lunar-payload-services/",
  },
  {
    id: "space-apps",
    labelKey: "refSpaceApps",
    href: "https://www.spaceappschallenge.org/",
  },
];

/** External APIs / services called by MANI. */
export const API_REFS: AboutRef[] = [
  {
    id: "horizons-api",
    labelKey: "refApiHorizons",
    href: "https://ssd.jpl.nasa.gov/api/horizons.api",
  },
  {
    id: "moon-trek-tiles",
    labelKey: "refApiMoonTrek",
    href: "https://trek.nasa.gov/moon/",
  },
  {
    id: "lola-pds",
    labelKey: "refApiLola",
    href: "https://imbrium.mit.edu/",
  },
  {
    id: "cesium",
    labelKey: "refApiCesium",
    href: "https://cesium.com/platform/cesiumjs/",
  },
];

/** Super Intelligence (SI) development tool. */
export const SI_REFS: AboutRef[] = [
  {
    id: "cursor",
    labelKey: "refSiCursor",
    href: "https://cursor.com/",
  },
];
