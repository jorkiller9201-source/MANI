/** Capture Cesium Moon Trek view framed on compare points A & B for report Annex A. */

export type MapPoint = { lat: number; lon: number; name?: string };

function moonEllipsoid(Cesium: any) {
  return Cesium.Ellipsoid.MOON || new Cesium.Ellipsoid(1737400.0, 1737400.0, 1737400.0);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Globe tile load + postRender frames before reading WebGL canvas. */
async function waitForGlobeFrame(viewer: any, maxMs = 12_000) {
  const globe = viewer.scene?.globe;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (globe?.tilesLoaded !== false) break;
    viewer.scene.requestRender();
    await sleep(80);
  }
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((resolve) => {
      const remove = viewer.scene.postRender.addEventListener(() => {
        remove();
        resolve();
      });
      viewer.scene.requestRender();
    });
  }
}

function regionLooksBlank(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const x0 = Math.floor(w * 0.12);
  const y0 = Math.floor(h * 0.08);
  const rw = Math.max(1, Math.floor(w * 0.76));
  const rh = Math.max(1, Math.floor(h * 0.72));
  const data = ctx.getImageData(x0, y0, rw, rh).data;
  let lit = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! + data[i + 1]! + data[i + 2]! > 52) lit++;
  }
  return lit / px < 0.025;
}

/** True when a saved JPEG is mostly empty/black (failed WebGL read). */
export function mapSnapshotLooksBlank(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 240 / Math.max(img.width, img.height));
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(true);
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(regionLooksBlank(ctx, c.width, c.height));
    };
    img.onerror = () => resolve(true);
    img.src = dataUrl;
  });
}

function project(viewer: any, Cesium: any, lon: number, lat: number, height: number) {
  const ellipsoid = moonEllipsoid(Cesium);
  const world = Cesium.Cartesian3.fromDegrees(lon, lat, height, ellipsoid);
  const canvasPos =
    viewer.scene.cartesianToCanvasCoordinates?.(world) ||
    Cesium.SceneTransforms?.worldToWindowCoordinates?.(viewer.scene, world);
  if (!Cesium.defined(canvasPos)) return null;
  if (!Number.isFinite(canvasPos.x) || !Number.isFinite(canvasPos.y)) return null;
  return canvasPos as { x: number; y: number };
}

function frameBoth(viewer: any, Cesium: any, a: MapPoint, b: MapPoint) {
  const ellipsoid = moonEllipsoid(Cesium);
  const cA = Cesium.Cartesian3.fromDegrees(a.lon, a.lat, 0, ellipsoid);
  const cB = Cesium.Cartesian3.fromDegrees(b.lon, b.lat, 0, ellipsoid);
  const mid = Cesium.Cartesian3.midpoint(cA, cB, new Cesium.Cartesian3());
  const carto = ellipsoid.cartesianToCartographic(mid);
  const sep = Cesium.Cartesian3.distance(cA, cB);
  const height = Math.min(Math.max(sep * 2.4, 220_000), 900_000);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height, ellipsoid),
    orientation: {
      heading: 0.0,
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0.0,
    },
  });
  viewer.scene.requestRender();
}

function fmtCoord(n: number, d = 4) {
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

function coordsLine(pt: MapPoint) {
  return `${fmtCoord(pt.lat)}°, ${fmtCoord(pt.lon)}°`;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  title: string,
  coords: string,
  x: number,
  y: number,
  fill: string,
  scale: number
) {
  const padX = 8 * scale;
  const titleSize = 13 * scale;
  const coordSize = 10.5 * scale;
  const lineGap = 3 * scale;
  const padY = 5 * scale;
  ctx.font = `700 ${titleSize}px Arial, sans-serif`;
  const titleW = ctx.measureText(title).width;
  ctx.font = `500 ${coordSize}px Arial, sans-serif`;
  const coordW = ctx.measureText(coords).width;
  const w = Math.max(titleW, coordW) + padX * 2;
  const h = padY * 2 + titleSize + lineGap + coordSize;
  const left = x - w / 2;
  const top = y - h - 28 * scale;
  ctx.fillStyle = "rgba(8,12,20,0.82)";
  ctx.strokeStyle = fill;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  const r = 4 * scale;
  ctx.moveTo(left + r, top);
  ctx.arcTo(left + w, top, left + w, top + h, r);
  ctx.arcTo(left + w, top + h, left, top + h, r);
  ctx.arcTo(left, top + h, left, top, r);
  ctx.arcTo(left, top, left + w, top, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${titleSize}px Arial, sans-serif`;
  ctx.fillText(title, x, top + padY);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `500 ${coordSize}px Arial, sans-serif`;
  ctx.fillText(coords, x, top + padY + titleSize + lineGap);
}

/**
 * Snapshot of the live Moon Trek globe with A/B in frame.
 * Restores the previous camera after capture. Returns JPEG data URL or null.
 */
export async function captureCompareMapSnapshot(
  a: MapPoint,
  b: MapPoint
): Promise<string | null> {
  const viewer = (typeof window !== "undefined" && (window as any).__maniViewer) || null;
  const Cesium = (typeof window !== "undefined" && (window as any).Cesium) || null;
  if (!viewer || !Cesium || viewer.isDestroyed?.()) return null;

  const cam = viewer.camera;
  const saved = {
    position: Cesium.Cartesian3.clone(cam.positionWC),
    direction: Cesium.Cartesian3.clone(cam.directionWC),
    up: Cesium.Cartesian3.clone(cam.upWC),
  };

  try {
    frameBoth(viewer, Cesium, a, b);
    await waitForGlobeFrame(viewer);

    const src = viewer.scene.canvas as HTMLCanvasElement;
    if (!src?.width || !src?.height) return null;

    const maxW = 1280;
    const scale = src.width > maxW ? maxW / src.width : 1;
    const out = document.createElement("canvas");
    out.width = Math.round(src.width * scale);
    out.height = Math.round(src.height * scale);
    const ctx = out.getContext("2d");
    if (!ctx) return null;

    let drewGlobe = false;
    for (let attempt = 0; attempt < 5 && !drewGlobe; attempt++) {
      if (attempt > 0) {
        await waitForGlobeFrame(viewer, 8_000);
        await sleep(180 * attempt);
      }
      viewer.scene.render();
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0, out.width, out.height);
      drewGlobe = !regionLooksBlank(ctx, out.width, out.height);
    }
    if (!drewGlobe) return null;

    const sx = out.width / src.clientWidth;
    const sy = out.height / src.clientHeight;
    for (const [pt, fill] of [
      [a, "#f2d27a"] as const,
      [b, "#7ec8ff"] as const,
    ]) {
      const p = project(viewer, Cesium, pt.lon, pt.lat, 12_000);
      if (!p) continue;
      drawLabel(
        ctx,
        pt.name || "·",
        coordsLine(pt),
        p.x * sx,
        p.y * sy,
        fill,
        Math.max(scale, 0.85)
      );
    }

    // Legend strip with name + coordinates under each point
    const legendH = 40;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(0, out.height - legendH, out.width, legendH);
    const drawLegend = (letter: string, pt: MapPoint, x: number, color: string) => {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.font = "700 12px Arial, sans-serif";
      ctx.fillText(`${letter}  ${pt.name || letter}`, x, out.height - legendH + 6);
      ctx.fillStyle = "#445566";
      ctx.font = "500 11px Arial, sans-serif";
      ctx.fillText(coordsLine(pt), x + 2, out.height - legendH + 22);
    };
    drawLegend("A", a, 12, "#8a6a1a");
    drawLegend("B", b, Math.min(out.width / 2, 300), "#1a5a8a");
    ctx.fillStyle = "#555";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("NASA Moon Trek · LRO WAC / LOLA", out.width - 12, out.height - legendH / 2);

    return out.toDataURL("image/jpeg", 0.84);
  } catch {
    return null;
  } finally {
    try {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.setView({
        destination: saved.position,
        orientation: { direction: saved.direction, up: saved.up },
      });
      viewer.scene.requestRender();
    } catch {
      /* ignore restore errors */
    }
  }
}
