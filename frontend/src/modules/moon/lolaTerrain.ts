/**
 * LOLA DEM → Cesium CustomHeightmapTerrainProvider (Moon Trek WMTS PNG).
 * 8-bit greyscale tiles are stretched elevation; mapped to meters with a global LOLA range.
 */

const TREK_LOLA_DEM =
  "/moon-tiles/Moon/EQ/LRO_LOLA_DEM_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png";

/** Approximate global LOLA height range relative to the lunar ellipsoid (m). */
const H_MIN_M = -9200;
const H_MAX_M = 10800;

export const LOLA_TERRAIN_TILE = 64;
export const LOLA_DEM_MAX_LEVEL = 5;
/**
 * Hard cap for Cesium quadtree requests. Ground view sits ~tens of meters above the mesh and
 * would otherwise request level 20+, where `1 << level` overflows Int32 inside Cesium and
 * updateFrustums throws RangeError: Invalid array length.
 */
export const LOLA_PROVIDER_MAX_LEVEL = 12;
/**
 * Ground / first-person: shallow quadtree (eye-level used to request deep LODs →
 * `Invalid array length` / freezes). 5–7 shows polar rims without Int32 overflow.
 * Orbit keeps ≤12.
 */
export const GROUND_LOLA_MAX_LEVEL = 6;

/** Visual exaggeration so south-pole rims read clearly from orbit. */
export const LOLA_TERRAIN_EXAGGERATION = 2.25;
/** Mild ground exaggeration — polar massifs at eye height without burying the camera. */
export const GROUND_LOLA_EXAGGERATION = 1.25;

function pow2(n: number): number {
  const e = Math.max(0, Math.min(30, Math.floor(n)));
  return 2 ** e;
}

function demUrl(level: number, trekRow: number, col: number): string {
  return TREK_LOLA_DEM.replace("{z}", String(level))
    .replace("{y}", String(trekRow))
    .replace("{x}", String(col));
}

function dnToHeightM(dn: number): number {
  const v = Number.isFinite(dn) ? dn : 0;
  return H_MIN_M + (v / 255) * (H_MAX_M - H_MIN_M);
}

function flatHeights(): Float32Array {
  return new Float32Array(LOLA_TERRAIN_TILE * LOLA_TERRAIN_TILE);
}

async function decodeDemTile(
  level: number,
  trekRow: number,
  col: number,
  outW: number,
  outH: number
): Promise<Float32Array | undefined> {
  if (!(outW > 0 && outH > 0 && outW * outH < 16_000_000)) return undefined;
  try {
    const res = await fetch(demUrl(level, trekRow, col), { mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(bmp, 0, 0, outW, outH);
    bmp.close?.();
    const { data } = ctx.getImageData(0, 0, outW, outH);
    const heights = new Float32Array(outW * outH);
    for (let i = 0, p = 0; i < heights.length; i++, p += 4) {
      // LA / greyscale PNG — R holds DN
      const h = dnToHeightM(data[p]!);
      heights[i] = Number.isFinite(h) ? h : 0;
    }
    return heights;
  } catch {
    return undefined;
  }
}

/**
 * Build a Moon-ellipsoid terrain provider from Moon Trek LOLA DEM tiles.
 * Returns null when Cesium lacks CustomHeightmapTerrainProvider.
 * @param maxLevel Cap Cesium quadtree requests (ground view should stay ≤8–12).
 */
export function createLolaTerrainProvider(
  Cesium: any,
  moonEllipsoid: any,
  maxLevel: number = LOLA_PROVIDER_MAX_LEVEL
): any | null {
  if (!Cesium?.CustomHeightmapTerrainProvider) return null;

  const levelCap = Math.max(
    0,
    Math.min(LOLA_PROVIDER_MAX_LEVEL, Math.floor(Number(maxLevel) || LOLA_PROVIDER_MAX_LEVEL))
  );

  const tilingScheme = new Cesium.GeographicTilingScheme({
    ellipsoid: moonEllipsoid,
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 1,
  });

  const provider = new Cesium.CustomHeightmapTerrainProvider({
    width: LOLA_TERRAIN_TILE,
    height: LOLA_TERRAIN_TILE,
    tilingScheme,
    ellipsoid: moonEllipsoid,
    credit: new Cesium.Credit("NASA Moon Trek / LRO LOLA DEM"),
    callback: async (x: number, y: number, level: number) => {
      const reqLevel = Math.max(0, Math.floor(Number(level) || 0));
      if (reqLevel > levelCap) return flatHeights();

      const z = Math.min(reqLevel, LOLA_DEM_MAX_LEVEL);
      const scale = pow2(reqLevel - z);
      const parentX = Math.floor(x / scale);
      const parentY = Math.floor(y / scale);
      const matrixH = pow2(z); // Trek MatrixHeight at level z
      const matrixW = matrixH * 2; // numberOfLevelZeroTilesX = 2
      const trekRow = Math.min(matrixH - 1, Math.max(0, matrixH - 1 - parentY));
      const trekCol = Math.min(matrixW - 1, Math.max(0, parentX));
      const heights = await decodeDemTile(z, trekRow, trekCol, LOLA_TERRAIN_TILE, LOLA_TERRAIN_TILE);
      if (!heights || heights.length !== LOLA_TERRAIN_TILE * LOLA_TERRAIN_TILE) {
        return flatHeights();
      }
      if (scale === 1) return heights;

      // Subsample parent tile for oversubscribed levels (> DEM max).
      const out = flatHeights();
      const subX0 = ((x % scale) + (x % scale < 0 ? scale : 0)) / scale;
      const subY0 = ((y % scale) + (y % scale < 0 ? scale : 0)) / scale;
      for (let row = 0; row < LOLA_TERRAIN_TILE; row++) {
        for (let col = 0; col < LOLA_TERRAIN_TILE; col++) {
          const u = subX0 + (col + 0.5) / LOLA_TERRAIN_TILE / scale;
          const v = subY0 + (row + 0.5) / LOLA_TERRAIN_TILE / scale;
          const sx = Math.min(LOLA_TERRAIN_TILE - 1, Math.max(0, Math.floor(u * LOLA_TERRAIN_TILE)));
          const sy = Math.min(LOLA_TERRAIN_TILE - 1, Math.max(0, Math.floor(v * LOLA_TERRAIN_TILE)));
          const h = heights[sy * LOLA_TERRAIN_TILE + sx]!;
          out[row * LOLA_TERRAIN_TILE + col] = Number.isFinite(h) ? h : 0;
        }
      }
      return out;
    },
  });

  // Refuse levels past the cap so Cesium never subdivides into Int32-overflow territory.
  provider.getTileDataAvailable = function getTileDataAvailable(
    _x: number,
    _y: number,
    level: number
  ) {
    return level <= levelCap;
  };

  // Avoid Cesium's `1 << level` Int32 overflow in geometric-error math.
  const levelZeroError = provider.getLevelMaximumGeometricError(0);
  provider.getLevelMaximumGeometricError = function getLevelMaximumGeometricError(level: number) {
    const lv = Math.max(0, Math.min(levelCap, Math.floor(Number(level) || 0)));
    return levelZeroError / pow2(lv);
  };

  return provider;
}
