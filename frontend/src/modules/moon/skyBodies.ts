/** Place Sun/Earth on the lunar globe from Horizons az/el at an observer site. */

export type EphemerisSample = {
  time: string;
  azimuth_deg: number;
  elevation_deg: number;
};

export type SkyBodyPose = {
  time: string;
  azimuth_deg: number;
  elevation_deg: number;
  aboveHorizon: boolean;
};

function moonEllipsoid(Cesium: any) {
  return Cesium.Ellipsoid.MOON || new Cesium.Ellipsoid(1737400.0, 1737400.0, 1737400.0);
}

export function parseIsoMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Nearest sample in the series to the requested instant (UTC). */
export function nearestSample(
  series: EphemerisSample[] | undefined | null,
  instantIso: string
): SkyBodyPose | null {
  if (!series?.length) return null;
  const target = parseIsoMs(instantIso);
  let best = series[0];
  let bestDist = Math.abs(parseIsoMs(best.time) - target);
  for (let i = 1; i < series.length; i++) {
    const d = Math.abs(parseIsoMs(series[i].time) - target);
    if (d < bestDist) {
      best = series[i];
      bestDist = d;
    }
  }
  const elev = Number(best.elevation_deg);
  return {
    time: best.time,
    azimuth_deg: Number(best.azimuth_deg),
    elevation_deg: elev,
    aboveHorizon: elev > 0,
  };
}

/** Unique sorted sample times from one or more series. */
export function seriesTimeOptions(...seriesList: (EphemerisSample[] | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const s of seriesList) {
    if (!s) continue;
    for (const p of s) {
      if (p?.time) set.add(p.time);
    }
  }
  return Array.from(set).sort((a, b) => parseIsoMs(a) - parseIsoMs(b));
}

/**
 * World position of a body seen from a lunar surface observer.
 * Horizons QUANTITIES=4 azimuth: degrees clockwise from north; elevation above horizon.
 */
export function bodyWorldPosition(
  Cesium: any,
  observer: { lat: number; lon: number },
  azimuthDeg: number,
  elevationDeg: number,
  rangeMeters = 140_000
) {
  const ellipsoid = moonEllipsoid(Cesium);
  const origin = Cesium.Cartesian3.fromDegrees(observer.lon, observer.lat, 8_000, ellipsoid);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);
  const az = Cesium.Math.toRadians(azimuthDeg);
  const el = Cesium.Math.toRadians(elevationDeg);
  const local = new Cesium.Cartesian3(
    Math.sin(az) * Math.cos(el) * rangeMeters,
    Math.cos(az) * Math.cos(el) * rangeMeters,
    Math.sin(el) * rangeMeters
  );
  return Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
}

function makeBodyPin(fill: string, letter: string, size = 56): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">
  <circle cx="28" cy="28" r="24" fill="${fill}" stroke="#111" stroke-width="2"/>
  <text x="28" y="34" text-anchor="middle" font-family="Arial,sans-serif"
        font-size="20" font-weight="700" fill="#111">${letter}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PIN_SUN = makeBodyPin("#ffc94a", "S");
const PIN_EARTH = makeBodyPin("#5eb0ff", "E");

const SUN_ID = "__mani_annex_sun";
const EARTH_ID = "__mani_annex_earth";

export function upsertSkyBodyEntities(
  viewer: any,
  Cesium: any,
  observer: { lat: number; lon: number },
  sun: SkyBodyPose | null,
  earth: SkyBodyPose | null
) {
  const upsert = (id: string, pose: SkyBodyPose | null, image: string, name: string) => {
    const existing = viewer.entities.getById(id);
    if (!pose) {
      if (existing) viewer.entities.remove(existing);
      return;
    }
    const position = bodyWorldPosition(Cesium, observer, pose.azimuth_deg, pose.elevation_deg);
    const alpha = pose.aboveHorizon ? 1 : 0.45;
    if (existing) {
      existing.position = position;
      if (existing.billboard) {
        existing.billboard.image = image;
        existing.billboard.color = Cesium.Color.WHITE.withAlpha(alpha);
      }
      return;
    }
    viewer.entities.add({
      id,
      name,
      position,
      billboard: {
        image,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: 1.15,
        color: Cesium.Color.WHITE.withAlpha(alpha),
      },
    });
  };
  upsert(SUN_ID, sun, PIN_SUN, "Sun");
  upsert(EARTH_ID, earth, PIN_EARTH, "Earth");
  viewer.scene.requestRender();
}

export function clearSkyBodyEntities(viewer: any) {
  for (const id of [SUN_ID, EARTH_ID]) {
    const e = viewer.entities.getById(id);
    if (e) viewer.entities.remove(e);
  }
}

export function formatSkyPose(pose: SkyBodyPose | null, label: string) {
  if (!pose) return `${label}: —`;
  const status = pose.aboveHorizon ? "above" : "below";
  return `${label}: az ${pose.azimuth_deg.toFixed(1)}° · elev ${pose.elevation_deg.toFixed(2)}° (${status})`;
}
