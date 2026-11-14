"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Site, SkySnapshot } from "@/lib/api";
import { dataApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import {
  celestialInMoonFrame,
  disableNativeCesiumSun,
  ensureSpaceFarPlane,
  guardCesiumSunRenderErrors,
  julianFromIso,
  SPACE_FAR_PLANE_M,
  type CelestialPose,
} from "./celestial";
import { SOUTH_POLE_NOMENCLATURE } from "./nomenclature";

export type CustomPoint = { lat: number; lon: number; name?: string };

export type SkyObserver = {
  lat: number;
  lon: number;
  elev_km?: number;
  site_id?: string | null;
  name?: string;
  /** Active compare slot that owns this horizon (A or B) */
  slot?: "a" | "b";
};

type Props = {
  sites: Site[];
  siteA?: string;
  siteB?: string;
  customA?: CustomPoint | null;
  customB?: CustomPoint | null;
  onSelect: (siteId: string) => void;
  /** Click empty lunar surface → arbitrary point for current A/B slot */
  onPickPoint?: (lat: number, lon: number) => void;
  offline?: boolean;
  focusSiteId?: string | null;
  focusLatLon?: { lat: number; lon: number } | null;
  focusNonce?: number;
  /** UTC ISO time for Sun/Earth horizon markers (Horizons) */
  skyTime?: string;
  onSkyTimeChange?: (iso: string) => void;
  skyObserver?: SkyObserver | null;
  compareStart?: string;
};

const TREK_WAC =
  "/moon-tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

/** LOLA color shaded relief (topography) via Moon Trek WMTS. */
const TREK_LOLA_RELIEF =
  "/moon-tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png";

const RELIEF_ALPHA = 0.72;

const COLOR_A = "#f2d27a";
const COLOR_B = "#7ec8ff";
const COLOR_OTHER = "#c8ccd4";
const COLOR_SUN = "#ffcc33";
const COLOR_EARTH = "#5b9fd4";

type SkyMark = {
  key: "sun" | "earth";
  x: number;
  y: number;
  label: string;
  size?: number;
  image?: string;
};

type HudLabel = {
  key: string;
  name: string;
  x: number;
  y: number;
  kind: "site" | "crater" | "region";
  role?: "a" | "b" | "other";
  siteId?: string;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).Cesium) resolve();
      else existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function ensureCss(href: string, id: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function moonEllipsoidOf(Cesium: any) {
  return Cesium.Ellipsoid.MOON || new Cesium.Ellipsoid(1737400.0, 1737400.0, 1737400.0);
}

/** Look straight down so the site sits in the center of the canvas (not under the bottom edge). */
function flyToSite(viewer: any, Cesium: any, site: { lat: number; lon: number }, duration = 1.4) {
  const ellipsoid = moonEllipsoidOf(Cesium);
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.__maniUserFlew = true;
  const destination = Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 180_000.0, ellipsoid);
  const orientation = {
    heading: 0.0,
    pitch: Cesium.Math.toRadians(-90.0),
    roll: 0.0,
  };
  const finish = () => {
    // Ensure free camera after fly so zoom buttons keep working.
    freeCameraFromCurrentPose(viewer, Cesium);
    viewer.__maniUserFlew = true;
    viewer.scene.requestRender();
  };
  if (duration <= 0) {
    viewer.camera.setView({ destination, orientation });
    finish();
  } else {
    viewer.camera.flyTo({
      destination,
      orientation,
      duration,
      complete: finish,
      cancel: finish,
    });
  }
}

function makeMapPin(fill: string, letter: string, size = 48): string {
  const fontSize = letter.length > 1 ? 14 : 18;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.5)}" viewBox="0 0 48 72">
  <path d="M24 0C12.4 0 3 9.4 3 21c0 14.2 21 51 21 51s21-36.8 21-51C45 9.4 35.6 0 24 0z"
        fill="${fill}" stroke="#111" stroke-width="2"/>
  <circle cx="24" cy="21" r="11" fill="#fff"/>
  <text x="24" y="26" text-anchor="middle" font-family="Arial,sans-serif"
        font-size="${fontSize}" font-weight="700" fill="#111">${letter}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PIN_A = makeMapPin(COLOR_A, "A", 52);
const PIN_B = makeMapPin(COLOR_B, "B", 52);
const PIN_OTHER = makeMapPin(COLOR_OTHER, "·", 34);

/** Equirectangular Earth map for entity ellipsoid material. */
/** Yellow flare disc + soft bursts — replaces Cesium.Sun burst shader. */
function makeSunFlareTexture(): string {
  const size = 192;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const cx = size / 2;
  const cy = size / 2;
  const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.48);
  bg.addColorStop(0, "rgba(255,240,180,1)");
  bg.addColorStop(0.22, "rgba(255,210,80,0.95)");
  bg.addColorStop(0.45, "rgba(255,170,40,0.55)");
  bg.addColorStop(0.75, "rgba(255,140,20,0.12)");
  bg.addColorStop(1, "rgba(255,120,0,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.46, -size * 0.06);
    ctx.lineTo(size * 0.46, size * 0.06);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, size * 0.46, 0);
    g.addColorStop(0, "rgba(255,220,100,0.55)");
    g.addColorStop(1, "rgba(255,180,40,0)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#fff8d8";
  ctx.fill();
  return c.toDataURL("image/png");
}

const SUN_FLARE_PX = 72;

function applySunBillboard(Cesium: any, billboard: any, image: string) {
  if (!billboard || !image) return;
  billboard.show = true;
  billboard.image = image;
  billboard.color = Cesium.Color.WHITE;
  billboard.width = SUN_FLARE_PX;
  billboard.height = SUN_FLARE_PX;
  billboard.sizeInMeters = false;
  billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
  billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
  billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
  billboard.scale = 1.0;
}

function makeEarthGlobeTexture(): string {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  // Oceans
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, "#071530");
  ocean.addColorStop(0.35, "#0d3a6e");
  ocean.addColorStop(0.55, "#145a9c");
  ocean.addColorStop(1, "#071530");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);
  // Continents (schematic)
  ctx.fillStyle = "#3d8f45";
  const land: [number, number, number, number, number][] = [
    [180, 200, 95, 55, -0.2], // Americas
    [220, 280, 40, 70, 0.4],
    [520, 180, 110, 50, 0.1], // Eurasia/Africa
    [560, 250, 55, 75, 0.15],
    [700, 210, 70, 40, -0.1],
    [820, 300, 55, 35, 0.2], // Australia-ish
  ];
  for (const [x, y, rw, rh, rot] of land) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Ice caps
  ctx.fillStyle = "#e8eef8";
  ctx.beginPath();
  ctx.ellipse(w / 2, 36, 220, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 32, 200, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  // Clouds
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse((i * 137) % w, 60 + ((i * 89) % (h - 120)), 18 + (i % 12), 6 + (i % 5), 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Billboard needs a disc with alpha; the equirectangular map is the source.
  const disc = document.createElement("canvas");
  disc.width = h;
  disc.height = h;
  const dctx = disc.getContext("2d");
  if (!dctx) return c.toDataURL("image/png");
  dctx.beginPath();
  dctx.arc(h / 2, h / 2, h / 2 - 1, 0, Math.PI * 2);
  dctx.clip();
  dctx.drawImage(c, (w - h) / 2, 0, h, h, 0, 0, h, h);
  dctx.strokeStyle = "rgba(90,160,220,0.55)";
  dctx.lineWidth = 3;
  dctx.stroke();
  return disc.toDataURL("image/png");
}

function skySunLabelGraphics(Cesium: any, text: string, color: string) {
  return {
    text,
    font: "bold 16px sans-serif",
    fillColor: Cesium.Color.fromCssColorString(color),
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 4,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    // y grows downward: the whole label hangs below the Cesium flare.
    pixelOffset: new Cesium.Cartesian2(0, 64),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("rgba(8,12,20,0.85)"),
    backgroundPadding: new Cesium.Cartesian2(10, 6),
  };
}

function skyEarthLabelGraphics(Cesium: any, text: string, color: string) {
  return {
    text,
    font: "bold 16px sans-serif",
    fillColor: Cesium.Color.fromCssColorString(color),
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 4,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    pixelOffset: new Cesium.Cartesian2(0, 56),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("rgba(8,12,20,0.85)"),
    backgroundPadding: new Cesium.Cartesian2(10, 6),
  };
}

/** Display radius ~2.2 × WGS84 so Earth reads as a planet from the Moon (~1.9° real). */
function earthDisplayRadiusM(Cesium: any) {
  const scale = 2.2;
  const r = Cesium.Ellipsoid.WGS84.radii;
  return ((r.x + r.y + r.z) / 3) * scale;
}

/**
 * BillboardCollection packs width into 16 bits (max 65536). A ~2.8e7 m Earth
 * diameter is clamped to 65 km and disappears from the Moon — only the label remains.
 * sizeInMeters stays on; shader size is width * scale.
 */
const EARTH_BB_PACKED_M = 4096;

function earthGlobeScale(Cesium: any) {
  return (earthDisplayRadiusM(Cesium) * 2) / EARTH_BB_PACKED_M;
}

function pixelsBelowDisc(viewer: any, radiusM: number, distanceM: number) {
  const frustum = viewer?.camera?.frustum;
  const fovy =
    typeof frustum?.fovy === "number"
      ? frustum.fovy
      : typeof frustum?.fov === "number"
        ? frustum.fov
        : Math.PI / 3;
  const canvasH = viewer?.scene?.canvas?.clientHeight || 800;
  const radiusPx = (radiusM / Math.max(distanceM, 1)) * (canvasH / Math.max(fovy, 0.25));
  return Math.max(48, Math.ceil(radiusPx + 18));
}

function applyEarthBillboard(Cesium: any, billboard: any, image: string) {
  if (!billboard || !image) return;
  billboard.show = true;
  billboard.image = image;
  billboard.color = Cesium.Color.WHITE;
  billboard.sizeInMeters = true;
  billboard.width = EARTH_BB_PACKED_M;
  billboard.height = EARTH_BB_PACKED_M;
  billboard.scale = earthGlobeScale(Cesium);
  billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
  billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
  billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
}

function hideStaleEarthEllipsoid(viewer: any) {
  const stale = viewer.entities?.getById?.("mani_earth_planet");
  if (stale) {
    stale.show = false;
    if (stale.ellipsoid) stale.ellipsoid.show = false;
  }
  const earth = viewer.entities?.getById?.("mani_earth_label");
  if (earth?.ellipsoid) earth.ellipsoid.show = false;
}

function projectCartesian(viewer: any, Cesium: any, world: any) {
  const canvasPos =
    viewer.scene.cartesianToCanvasCoordinates?.(world) ||
    Cesium.SceneTransforms?.worldToWindowCoordinates?.(viewer.scene, world);
  if (!Cesium.defined(canvasPos)) return null;
  if (!Number.isFinite(canvasPos.x) || !Number.isFinite(canvasPos.y)) return null;
  const w = viewer.scene.canvas.clientWidth;
  const h = viewer.scene.canvas.clientHeight;
  if (canvasPos.x < -80 || canvasPos.y < -80 || canvasPos.x > w + 80 || canvasPos.y > h + 80) return null;
  return canvasPos;
}

function projectOnCanvas(viewer: any, Cesium: any, lon: number, lat: number, height: number) {
  const ellipsoid = moonEllipsoidOf(Cesium);
  const world = Cesium.Cartesian3.fromDegrees(lon, lat, height, ellipsoid);
  const canvasPos =
    viewer.scene.cartesianToCanvasCoordinates?.(world) ||
    Cesium.SceneTransforms?.worldToWindowCoordinates?.(viewer.scene, world);
  if (!Cesium.defined(canvasPos)) return null;
  if (!Number.isFinite(canvasPos.x) || !Number.isFinite(canvasPos.y)) return null;
  const w = viewer.scene.canvas.clientWidth;
  const h = viewer.scene.canvas.clientHeight;
  // Keep a margin so labels are not clipped by the edge
  if (canvasPos.x < 8 || canvasPos.y < 8 || canvasPos.x > w - 8 || canvasPos.y > h - 8) return null;
  return canvasPos;
}

const navBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(8,12,20,0.88)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
};

function unlockCamera(viewer: any, Cesium: any) {
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.__maniUserFlew = true;
}

/** Convert a lookAt-locked pose into a free camera so zoom/pan persist. */
function freeCameraFromCurrentPose(viewer: any, Cesium: any) {
  const position = Cesium.Cartesian3.clone(viewer.camera.positionWC);
  const direction = Cesium.Cartesian3.clone(viewer.camera.directionWC);
  const up = Cesium.Cartesian3.clone(viewer.camera.upWC);
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.camera.setView({
    destination: position,
    orientation: { direction, up },
  });
}

/** Home / initial view: looking down on the lunar south pole (CLPS region). */
function frameSouthPoleHome(viewer: any, Cesium: any) {
  const ellipsoid = moonEllipsoidOf(Cesium);
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  // ~500 km above the pole — wide enough for Shackleton / Malapert / neighbors.
  const destination = Cesium.Cartesian3.fromDegrees(0.0, -90.0, 500_000.0, ellipsoid);
  viewer.camera.setView({
    destination,
    orientation: {
      heading: 0.0,
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0.0,
    },
  });
  freeCameraFromCurrentPose(viewer, Cesium);
  viewer.scene.requestRender();
}

function dollyZoom(viewer: any, Cesium: any, rangeScale: number) {
  const center = Cesium.Cartesian3.ZERO;
  const radius = moonEllipsoidOf(Cesium).maximumRadius;
  const pos = Cesium.Cartesian3.clone(viewer.camera.positionWC);
  const outward = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(pos, center, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  const dist = Cesium.Math.clamp(
    Cesium.Cartesian3.magnitude(
      Cesium.Cartesian3.subtract(pos, center, new Cesium.Cartesian3())
    ) * rangeScale,
    radius * 1.08,
    radius * 14
  );
  const newPos = Cesium.Cartesian3.multiplyByScalar(outward, dist, new Cesium.Cartesian3());
  const direction = Cesium.Cartesian3.negate(outward, new Cesium.Cartesian3());
  const up = Cesium.Cartesian3.clone(viewer.camera.upWC);

  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.camera.setView({
    destination: newPos,
    orientation: { direction, up },
  });
  viewer.__maniUserFlew = true;
  viewer.scene.requestRender();
}

function orbitMoon(viewer: any, Cesium: any, deltaHeadingRad: number, deltaPitchRad: number) {
  const center = Cesium.Cartesian3.ZERO;
  const radius = moonEllipsoidOf(Cesium).maximumRadius;
  const range = Cesium.Math.clamp(
    Cesium.Cartesian3.distance(viewer.camera.positionWC, center),
    radius * 1.08,
    radius * 14
  );

  // Temporary lookAt to rotate around the Moon, then unlock so the pose sticks.
  viewer.camera.lookAt(
    center,
    new Cesium.HeadingPitchRange(
      viewer.camera.heading + deltaHeadingRad,
      Cesium.Math.clamp(
        viewer.camera.pitch + deltaPitchRad,
        Cesium.Math.toRadians(-89),
        Cesium.Math.toRadians(89)
      ),
      range
    )
  );
  freeCameraFromCurrentPose(viewer, Cesium);
  viewer.__maniUserFlew = true;
  viewer.scene.requestRender();
}

export default function MoonMap({
  sites,
  siteA,
  siteB,
  customA,
  customB,
  onSelect,
  onPickPoint,
  offline,
  focusSiteId,
  focusLatLon,
  focusNonce,
  skyTime,
  onSkyTimeChange,
  skyObserver,
  compareStart,
}: Props) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPickPointRef = useRef(onPickPoint);
  onPickPointRef.current = onPickPoint;
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const siteARef = useRef(siteA);
  const siteBRef = useRef(siteB);
  siteARef.current = siteA;
  siteBRef.current = siteB;
  const customARef = useRef(customA);
  const customBRef = useRef(customB);
  customARef.current = customA;
  customBRef.current = customB;
  const showNamesRef = useRef(true);
  const showCratersRef = useRef(true);
  const reliefLayerRef = useRef<any>(null);

  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [error, setError] = useState("");
  const [showNames, setShowNames] = useState(true);
  const [showCraters, setShowCraters] = useState(true);
  const [showRelief, setShowRelief] = useState(true);
  const [showSky, setShowSky] = useState(true);
  const [sky, setSky] = useState<SkySnapshot | null>(null);
  const [skyBusy, setSkyBusy] = useState(false);
  const [skyError, setSkyError] = useState("");
  const [hudLabels, setHudLabels] = useState<HudLabel[]>([]);
  const [skyMarks, setSkyMarks] = useState<SkyMark[]>([]);

  useEffect(() => {
    let destroyed = false;

    async function boot() {
      if (!containerRef.current) return;
      try {
        setPhase("loading");
        (window as any).CESIUM_BASE_URL = "/cesium/";
        ensureCss("/cesium/Widgets/widgets.css", "cesium-widgets-css");
        await loadScript("/cesium/Cesium.js");
        const Cesium = (window as any).Cesium;
        if (!Cesium) throw new Error("Cesium global not available");

        const moonEllipsoid = moonEllipsoidOf(Cesium);
        const markerH = 12_000;

        const skyBox =
          typeof Cesium.SkyBox.createEarthSkyBox === "function"
            ? Cesium.SkyBox.createEarthSkyBox()
            : new Cesium.SkyBox({
                sources: {
                  positiveX: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
                  negativeX: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
                  positiveY: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
                  negativeY: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
                  positiveZ: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
                  negativeZ: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
                },
              });

        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          baseLayer: false,
          skyAtmosphere: false,
          skyBox,
          sun: false,
          moon: false,
          globe: new Cesium.Globe(moonEllipsoid),
          mapProjection: new Cesium.GeographicProjection(moonEllipsoid),
          requestRenderMode: false,
          shouldAnimate: false,
          // Far plane is ~1.6 AU so the Sun is not clipped. That ratio breaks
          // order-independent translucency and drops every billboard/label.
          orderIndependentTranslucency: false,
          contextOptions: { webgl: { alpha: false } },
        });

        if (destroyed) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;
        (window as any).__maniViewer = viewer;

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#8a8a8a");
        viewer.scene.globe.showGroundAtmosphere = false;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = false;
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.fog.enabled = false;
        viewer.scene.logarithmicDepthBuffer = true;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
        // Native Cesium.Sun burst shader breaks on some GPUs — flare is a billboard / screen disc.
        guardCesiumSunRenderErrors(viewer);
        if (viewer.scene.moon) viewer.scene.moon.show = false;
        // Far plane past 1 AU; wider FOV keeps the near-horizon Sun in frame at the pole
        if (viewer.camera?.frustum) {
          viewer.camera.frustum.near = 1.0;
          viewer.camera.frustum.far = SPACE_FAR_PLANE_M;
          if (typeof viewer.camera.frustum.fov === "number") {
            viewer.camera.frustum.fov = Cesium.Math.toRadians(75);
          }
        }
        viewer.scene.preRender.addEventListener(() => {
          if ((viewer as any).__maniCelestialPose) ensureSpaceFarPlane(viewer);
        });
        viewer.imageryLayers.removeAll();

        // Earth is a screen-facing billboard at the real Moon-fixed position.
        // disableDepthTestDistance Infinity draws it even when the opaque Moon globe
        // is in front (Earth below the south-pole horizon, elev < 0).
        const earthTex = makeEarthGlobeTexture();
        const sunTex = makeSunFlareTexture();
        (viewer as any).__maniEarthTexture = earthTex;
        (viewer as any).__maniSunTexture = sunTex;
        (viewer as any).__maniCelestialPose = null as CelestialPose | null;

        viewer.entities.add({
          id: "mani_sun_label",
          show: false,
          position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.UNIT_X),
          billboard: {
            image: sunTex,
            show: false,
            width: SUN_FLARE_PX,
            height: SUN_FLARE_PX,
            sizeInMeters: false,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: skySunLabelGraphics(Cesium, "Sol", COLOR_SUN),
        });
        viewer.entities.add({
          id: "mani_earth_label",
          show: false,
          position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.UNIT_X),
          billboard: {
            image: earthTex || makeEarthGlobeTexture(),
            color: Cesium.Color.WHITE,
            sizeInMeters: true,
            width: EARTH_BB_PACKED_M,
            height: EARTH_BB_PACKED_M,
            scale: earthGlobeScale(Cesium),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            show: true,
          },
          label: skyEarthLabelGraphics(Cesium, "Tierra", COLOR_EARTH),
        });
        hideStaleEarthEllipsoid(viewer);

        const moonTiling = () =>
          new Cesium.GeographicTilingScheme({
            ellipsoid: moonEllipsoid,
            numberOfLevelZeroTilesX: 2,
            numberOfLevelZeroTilesY: 1,
          });

        if (!offline) {
          // Base: LRO WAC photo mosaic
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: TREK_WAC,
              maximumLevel: 8,
              credit: new Cesium.Credit("NASA Moon Trek / LRO WAC"),
              tilingScheme: moonTiling(),
            })
          );

          // Overlay: LOLA color shaded relief (topography)
          const reliefProvider = new Cesium.UrlTemplateImageryProvider({
            url: TREK_LOLA_RELIEF,
            maximumLevel: 5,
            credit: new Cesium.Credit("NASA Moon Trek / LRO LOLA ClrShade"),
            tilingScheme: moonTiling(),
          });
          const reliefLayer = viewer.imageryLayers.addImageryProvider(reliefProvider);
          reliefLayer.alpha = RELIEF_ALPHA;
          reliefLayer.show = true;
          reliefLayerRef.current = reliefLayer;
          (viewer as any).__maniReliefLayer = reliefLayer;
        }

        // Mouse / touch camera — moon-scale distances, no bounce-back inertia.
        const ssc = viewer.scene.screenSpaceCameraController;
        ssc.enableCollisionDetection = false;
        ssc.inertiaSpin = 0;
        ssc.inertiaTranslate = 0;
        ssc.inertiaZoom = 0;
        ssc.minimumZoomDistance = 40_000; // ~40 km above surface
        ssc.maximumZoomDistance = 800_000_000; // past Earth; Sun stays at 1 AU (not a zoom target)
        ssc.zoomFactor = 2.0;

        const markUserCamera = () => {
          // Keep free camera: any mouse orbit must not revive a lookAt lock.
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          viewer.camera.constrainedAxis = undefined;
          viewer.__maniUserFlew = true;
        };
        viewer.camera.moveStart.addEventListener(markUserCamera);
        (viewer as any).__maniMarkUserCamera = markUserCamera;

        let initialFramed = false;
        const frameFullMoon = () => {
          if (destroyed || !viewerRef.current) return;
          viewer.resize();
          // Only the first paint may set the home pose — never again (mouse/zoom must stick).
          if (!initialFramed && !viewer.__maniUserFlew) {
            frameSouthPoleHome(viewer, Cesium);
            initialFramed = true;
          }
          setPhase("ready");
        };

        const onResize = () => {
          if (destroyed || !viewerRef.current) return;
          viewer.resize();
          viewer.scene.requestRender();
        };
        window.addEventListener("resize", onResize);
        (viewer as any).__maniOnResize = onResize;

        requestAnimationFrame(() => {
          try {
            frameFullMoon();
            // Resize only after layout — do NOT re-apply south-pole home (that killed mouse zoom).
            setTimeout(() => {
              if (destroyed || !viewerRef.current) return;
              viewer.resize();
              viewer.scene.requestRender();
            }, 350);
          } catch (e) {
            console.warn(e);
          }
        });

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: any) => {
          markUserCamera();
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id && picked.id.siteId) {
            onSelectRef.current(picked.id.siteId);
            return;
          }
          // Two-click workflow: empty surface → arbitrary lat/lon for A then B
          if (!onPickPointRef.current) return;
          const ray = viewer.camera.getPickRay(click.position);
          if (!ray) return;
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (!Cesium.defined(cartesian)) return;
          const carto = moonEllipsoid.cartesianToCartographic(cartesian);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          onPickPointRef.current(lat, lon);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(() => markUserCamera(), Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction(() => markUserCamera(), Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
        handler.setInputAction(() => markUserCamera(), Cesium.ScreenSpaceEventType.RIGHT_DOWN);
        handler.setInputAction(() => markUserCamera(), Cesium.ScreenSpaceEventType.WHEEL);
        handler.setInputAction(() => markUserCamera(), Cesium.ScreenSpaceEventType.PINCH_START);
        (viewer as any).__maniNavHandler = handler;

        const depthOff = Number.POSITIVE_INFINITY;

        sitesRef.current.forEach((s) => {
          const isA = s.id === siteARef.current;
          const isB = s.id === siteBRef.current;
          viewer.entities.add({
            id: s.id,
            siteId: s.id,
            name: s.name,
            description: `${s.notes}<br/>Lat ${s.lat}, Lon ${s.lon}`,
            position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, markerH, moonEllipsoid),
            billboard: {
              image: isA ? PIN_A : isB ? PIN_B : PIN_OTHER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              disableDepthTestDistance: depthOff,
              scale: isA || isB ? 1.1 : 0.85,
              scaleByDistance: new Cesium.NearFarScalar(2.0e4, 1.3, 5.0e6, 0.5),
            },
          });
        });

        setError("");
        setPhase("ready");
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
        setPhase("failed");
      }
    }

    boot();
    return () => {
      destroyed = true;
      const v = viewerRef.current;
      if (v?.__maniOnResize) window.removeEventListener("resize", v.__maniOnResize);
      if (v?.__maniMarkUserCamera) {
        try {
          v.camera.moveStart.removeEventListener(v.__maniMarkUserCamera);
        } catch {
          /* ignore */
        }
      }
      if (v?.__maniNavHandler && !v.__maniNavHandler.isDestroyed?.()) {
        try {
          v.__maniNavHandler.destroy();
        } catch {
          /* ignore */
        }
      }
      if (v && !v.isDestroyed?.()) v.destroy();
      viewerRef.current = null;
    };
  }, [offline]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium) return;
    const moonEllipsoid = moonEllipsoidOf(Cesium);
    const markerH = 12_000;
    sites.forEach((s) => {
      const pin = viewer.entities.getById(s.id);
      if (!pin?.billboard) return;
      const isA = !customA && s.id === siteA;
      const isB = !customB && s.id === siteB;
      pin.billboard.image = isA ? PIN_A : isB ? PIN_B : PIN_OTHER;
      pin.billboard.scale = isA || isB ? 1.1 : 0.85;
    });

    const upsertCustom = (id: string, pt: CustomPoint | null | undefined, pinImg: string, label: string) => {
      const existing = viewer.entities.getById(id);
      if (!pt) {
        if (existing) viewer.entities.remove(existing);
        return;
      }
      const pos = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, markerH, moonEllipsoid);
      if (existing) {
        existing.position = pos;
        if (existing.billboard) {
          existing.billboard.image = pinImg;
          existing.billboard.scale = 1.15;
        }
        return;
      }
      viewer.entities.add({
        id,
        name: label,
        position: pos,
        billboard: {
          image: pinImg,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.NONE,
          scale: 1.15,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    };
    upsertCustom("mani_custom_a", customA, PIN_A, customA?.name || "Custom A");
    upsertCustom("mani_custom_b", customB, PIN_B, customB?.name || "Custom B");
    viewer.scene.requestRender();
  }, [siteA, siteB, sites, customA, customB]);

  // HUD names drawn ABOVE the Cesium canvas (never under the globe depth buffer).
  useEffect(() => {
    showNamesRef.current = showNames;
    showCratersRef.current = showCraters;
    if ((!showNames && !showCraters) || phase !== "ready") {
      setHudLabels([]);
      return;
    }

    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || viewer.isDestroyed?.()) return;

    let raf = 0;
    const update = () => {
      if (!viewerRef.current) return;
      const next: HudLabel[] = [];

      if (showNamesRef.current) {
        for (const s of sitesRef.current) {
          const p = projectOnCanvas(viewer, Cesium, s.lon, s.lat, 12_000);
          if (!p) continue;
          const role: "a" | "b" | "other" =
            !customARef.current && s.id === siteARef.current
              ? "a"
              : !customBRef.current && s.id === siteBRef.current
                ? "b"
                : "other";
          next.push({
            key: `site-${s.id}`,
            name: s.name,
            x: p.x,
            y: p.y - 42,
            kind: "site",
            role,
            siteId: s.id,
          });
        }
        const customs: { key: string; pt: CustomPoint; role: "a" | "b" }[] = [];
        if (customARef.current) customs.push({ key: "custom-a", pt: customARef.current, role: "a" });
        if (customBRef.current) customs.push({ key: "custom-b", pt: customBRef.current, role: "b" });
        for (const c of customs) {
          const p = projectOnCanvas(viewer, Cesium, c.pt.lon, c.pt.lat, 12_000);
          if (!p) continue;
          next.push({
            key: c.key,
            name: c.pt.name || (c.role === "a" ? "A" : "B"),
            x: p.x,
            y: p.y - 42,
            kind: "site",
            role: c.role,
          });
        }
      }

      if (showCratersRef.current) {
        const range = Math.max(
          0,
          Cesium.Cartesian3.magnitude(viewer.camera.positionWC) - moonEllipsoidOf(Cesium).maximumRadius
        );
        const minDiam = range > 1_000_000 ? 80 : range > 350_000 ? 40 : 15;
        for (const f of SOUTH_POLE_NOMENCLATURE) {
          if (f.kind === "crater" && f.diameter_km > 0 && f.diameter_km < minDiam) continue;
          const p = projectOnCanvas(viewer, Cesium, f.lon, f.lat, 14_000);
          if (!p) continue;
          next.push({
            key: `nom-${f.name}`,
            name: f.name,
            x: p.x,
            y: p.y - 10,
            kind: f.kind,
          });
        }
      }

      setHudLabels(next);
    };

    const onPostRender = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    viewer.scene.postRender.addEventListener(onPostRender);
    update();
    return () => {
      viewer.scene.postRender.removeEventListener(onPostRender);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showNames, showCraters, phase, sites, siteA, siteB, customA, customB]);

  // Earth disc + Sun name in screen space. Entity billboards at this range
  // never reach the color buffer once the far plane sits past 1 AU.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || phase !== "ready") return;
    if (!showSky) {
      setSkyMarks([]);
      return;
    }
    let raf = 0;
    const update = () => {
      const pose = (viewer as any).__maniCelestialPose as CelestialPose | null;
      const labels = (viewer as any).__maniSkyLabels as { sun?: string; earth?: string } | null;
      if (!pose || !labels) {
        setSkyMarks([]);
        return;
      }
      const marks: SkyMark[] = [];
      const earthP = projectCartesian(viewer, Cesium, pose.earthMoonFixed);
      if (earthP && labels.earth) {
        const dist = Math.max(1, Cesium.Cartesian3.distance(viewer.camera.positionWC, pose.earthMoonFixed));
        const frustum = viewer.camera.frustum;
        const fovy =
          typeof frustum?.fovy === "number"
            ? frustum.fovy
            : typeof frustum?.fov === "number"
              ? frustum.fov
              : Math.PI / 3;
        const px = Math.max(
          32,
          Math.min(240, ((earthDisplayRadiusM(Cesium) * 2) / dist) * ((viewer.scene.canvas.clientHeight || 800) / fovy))
        );
        marks.push({
          key: "earth",
          x: earthP.x,
          y: earthP.y,
          label: labels.earth,
          size: px,
          image: (viewer as any).__maniEarthTexture || "",
        });
      }
      const sunPos = Cesium.Cartesian3.add(
        viewer.camera.positionWC,
        Cesium.Cartesian3.multiplyByScalar(pose.sunDirection, 2_000_000, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      const sunP = projectCartesian(viewer, Cesium, sunPos);
      if (sunP && labels.sun) {
        const sunEnt = viewer.entities.getById("mani_sun_label");
        if (sunEnt) {
          sunEnt.position = new Cesium.ConstantPositionProperty(sunPos);
        }
        marks.push({
          key: "sun",
          x: sunP.x,
          y: sunP.y,
          label: labels.sun,
          size: SUN_FLARE_PX,
          image: (viewer as any).__maniSunTexture || makeSunFlareTexture(),
        });
      }
      setSkyMarks(marks);
    };
    const onPost = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    viewer.scene.postRender.addEventListener(onPost);
    update();
    return () => {
      viewer.scene.postRender.removeEventListener(onPost);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [phase, showSky]);

  useEffect(() => {
    const layer = reliefLayerRef.current || viewerRef.current?.__maniReliefLayer;
    if (!layer) return;
    layer.show = showRelief;
    layer.alpha = showRelief ? RELIEF_ALPHA : 0;
    viewerRef.current?.scene?.requestRender?.();
  }, [showRelief, phase]);

  // Fetch Horizons Sun/Earth at skyTime for observer (site A).
  useEffect(() => {
    if (!showSky || !skyTime || !skyObserver || phase !== "ready") {
      if (!showSky) {
        setSky(null);
        setSkyError("");
      }
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSkyBusy(true);
      setSkyError("");
      try {
        const snap = await dataApi.sky({
          time: skyTime,
          lat: skyObserver.lat,
          lon: skyObserver.lon,
          elev_km: skyObserver.elev_km ?? 0,
          site_id: skyObserver.site_id,
        });
        if (!cancelled) setSky(snap);
      } catch (e: any) {
        if (!cancelled) {
          setSky(null);
          setSkyError(e?.message || t("skyFailed"));
        }
      } finally {
        if (!cancelled) setSkyBusy(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [showSky, skyTime, skyObserver, phase, t]);

  // Native Cesium sky: SkyBox stars + Sun + Earth billboard (depth-test off).
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || phase !== "ready") return;

    const sunLabel = viewer.entities.getById("mani_sun_label");
    const earthLabel = viewer.entities.getById("mani_earth_label");
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
    viewer.scene.backgroundColor = Cesium.Color.BLACK;

    const setRayLabel = (ent: any, text: string, dirOrPos: any, belowPx: number) => {
      if (!ent || !dirOrPos) return;
      // Put labels on the true body (Earth) or along the Sun ray at readable range
      const isEarth = ent.id === "mani_earth_label";
      let pos: any;
      if (isEarth) {
        pos = Cesium.Cartesian3.clone(dirOrPos, new Cesium.Cartesian3());
      } else {
        const unit = Cesium.Cartesian3.normalize(dirOrPos, new Cesium.Cartesian3());
        pos = Cesium.Cartesian3.multiplyByScalar(unit, 100_000_000, new Cesium.Cartesian3());
      }
      ent.show = true;
      ent.position = new Cesium.ConstantPositionProperty(pos);
      if (ent.label) {
        ent.label.text = text;
        ent.label.show = true;
        ent.label.verticalOrigin = Cesium.VerticalOrigin.TOP;
        ent.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
        ent.label.pixelOffset = new Cesium.Cartesian2(0, belowPx);
        ent.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
      }
    };

    const clearPose = () => {
      (viewer as any).__maniCelestialPose = null;
      if (sunLabel) sunLabel.show = false;
      if (earthLabel) earthLabel.show = false;
      (viewer as any).__maniSkyLabels = null;
      disableNativeCesiumSun(viewer);
      if (sunLabel?.billboard) sunLabel.billboard.show = false;
      viewer.scene.globe.enableLighting = false;
    };

    if (!showSky || !skyTime) {
      clearPose();
      viewer.scene.requestRender();
      return;
    }

    const date = julianFromIso(Cesium, skyTime);
    viewer.clock.currentTime = Cesium.JulianDate.clone(date);
    viewer.clock.shouldAnimate = false;

    const pose = celestialInMoonFrame(Cesium, date);
    (viewer as any).__maniCelestialPose = pose;

    if (!pose) {
      clearPose();
      viewer.scene.requestRender();
      return;
    }

    disableNativeCesiumSun(viewer);

    hideStaleEarthEllipsoid(viewer);
    let sunTex = (viewer as any).__maniSunTexture as string | undefined;
    if (!sunTex) {
      sunTex = makeSunFlareTexture();
      (viewer as any).__maniSunTexture = sunTex;
    }
    if (sunLabel && sunTex) {
      if (!sunLabel.billboard) sunLabel.billboard = {};
      applySunBillboard(Cesium, sunLabel.billboard, sunTex);
    }
    let earthTex = (viewer as any).__maniEarthTexture as string | undefined;
    if (!earthTex) {
      earthTex = makeEarthGlobeTexture();
      (viewer as any).__maniEarthTexture = earthTex;
    }
    if (earthLabel && earthTex) {
      if (!earthLabel.billboard) earthLabel.billboard = {};
      applyEarthBillboard(Cesium, earthLabel.billboard, earthTex);
    }

    const sunText =
      sky?.sun?.elevation_deg != null
        ? `${t("skySun")}  ${sky.sun.elevation_deg >= 0 ? "+" : ""}${sky.sun.elevation_deg.toFixed(1)}°`
        : t("skySun");
    const earthText =
      sky?.earth?.elevation_deg != null
        ? `${t("skyEarth")}  ${sky.earth.elevation_deg >= 0 ? "+" : ""}${sky.earth.elevation_deg.toFixed(1)}°`
        : t("skyEarth");
    const earthBelow = pixelsBelowDisc(
      viewer,
      earthDisplayRadiusM(Cesium),
      Cesium.Cartesian3.magnitude(pose.earthMoonFixed)
    );
    const cam = viewer.camera.positionWC;
    const sunBillboardPos = Cesium.Cartesian3.add(
      cam,
      Cesium.Cartesian3.multiplyByScalar(pose.sunDirection, 2_000_000, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    if (sunLabel) {
      sunLabel.show = true;
      sunLabel.position = new Cesium.ConstantPositionProperty(sunBillboardPos);
      if (sunLabel.label) {
        sunLabel.label.text = sunText;
        sunLabel.label.show = true;
        sunLabel.label.pixelOffset = new Cesium.Cartesian2(0, 64);
      }
      if (sunLabel.billboard) sunLabel.billboard.show = true;
    }
    setRayLabel(earthLabel, earthText, pose.earthMoonFixed, earthBelow);
    // Far plane past 1 AU — entity billboards may not rasterize; screen marks keep the disc visible.
    if (sunLabel?.label) sunLabel.label.show = false;
    if (sunLabel?.billboard) sunLabel.billboard.show = false;
    if (earthLabel?.billboard) earthLabel.billboard.show = false;
    if (earthLabel?.label) earthLabel.label.show = false;
    (viewer as any).__maniSkyLabels = { sun: sunText, earth: earthText };

    viewer.scene.globe.enableLighting = true;
    viewer.scene.light = new Cesium.DirectionalLight({
      direction: Cesium.Cartesian3.negate(pose.sunDirection, new Cesium.Cartesian3()),
      color: Cesium.Color.fromCssColorString("#fff4d0"),
      intensity: 2.0,
    });

    ensureSpaceFarPlane(viewer);
    viewer.scene.requestRender();
  }, [showSky, skyTime, sky, phase, t]);

  useEffect(() => {
    if (focusNonce == null || phase !== "ready") return;
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || viewer.isDestroyed?.()) return;
    let target: { lat: number; lon: number } | undefined = focusLatLon || undefined;
    if (!target && focusSiteId) {
      const site = sitesRef.current.find((s) => s.id === focusSiteId);
      if (site) target = { lat: site.lat, lon: site.lon };
    }
    if (!target) return;
    viewer.__maniUserFlew = true;
    try {
      flyToSite(viewer, Cesium, target);
    } catch (e) {
      console.warn("flyToSite failed", e);
    }
  }, [focusSiteId, focusLatLon, focusNonce, phase]);

  function pan(dir: "left" | "right" | "up" | "down") {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || phase !== "ready") return;
    const step = Cesium.Math.toRadians(12);
    if (dir === "left") orbitMoon(viewer, Cesium, -step, 0);
    else if (dir === "right") orbitMoon(viewer, Cesium, step, 0);
    else if (dir === "up") orbitMoon(viewer, Cesium, 0, step);
    else orbitMoon(viewer, Cesium, 0, -step);
  }

  function zoom(direction: "in" | "out") {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || phase !== "ready") return;
    dollyZoom(viewer, Cesium, direction === "in" ? 0.8 : 1.25);
  }

  function resetView() {
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium || phase !== "ready") return;
    frameSouthPoleHome(viewer, Cesium);
    viewer.__maniUserFlew = true;
  }

  return (
    <div
      ref={rootRef}
      className="h-full w-full min-h-[380px] overflow-hidden rounded-lg border border-white/10 bg-black"
      style={{ position: "relative" }}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
      />

      <div
        className="overflow-hidden"
        style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}
      >
        {skyMarks.map((m) =>
          m.key === "earth" ? (
            <div
              key="earth"
              style={{
                position: "absolute",
                left: m.x,
                top: m.y,
                transform: "translate(-50%, -50%)",
                zIndex: 4,
              }}
            >
              {m.image ? (
                <img
                  src={m.image}
                  alt=""
                  draggable={false}
                  style={{
                    display: "block",
                    width: m.size,
                    height: m.size,
                    borderRadius: "50%",
                    boxShadow: "0 0 14px rgba(150,200,255,0.55)",
                  }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: (m.size || 48) / 2 + 10,
                  transform: "translateX(-50%)",
                  color: COLOR_EARTH,
                  font: "bold 16px sans-serif",
                  whiteSpace: "nowrap",
                  background: "rgba(8,12,20,0.85)",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}
              >
                {m.label}
              </div>
            </div>
          ) : (
            <div
              key="sun"
              style={{
                position: "absolute",
                left: m.x,
                top: m.y,
                transform: "translate(-50%, -50%)",
                zIndex: 4,
              }}
            >
              {m.image ? (
                <img
                  src={m.image}
                  alt=""
                  draggable={false}
                  style={{
                    display: "block",
                    width: m.size || SUN_FLARE_PX,
                    height: m.size || SUN_FLARE_PX,
                    borderRadius: "50%",
                    boxShadow: "0 0 22px rgba(255,200,80,0.75), 0 0 48px rgba(255,160,40,0.35)",
                  }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: (m.size || SUN_FLARE_PX) / 2 + 64,
                  transform: "translateX(-50%)",
                  color: COLOR_SUN,
                  font: "bold 16px sans-serif",
                  whiteSpace: "nowrap",
                  background: "rgba(8,12,20,0.85)",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}
              >
                {m.label}
              </div>
            </div>
          )
        )}
        {hudLabels.map((lbl) => {
          const isSite = lbl.kind === "site";
          // Crater / region names: letters only (no box). Sites keep A/B badges.
          if (!isSite) {
            return (
              <span
                key={lbl.key}
                className="whitespace-nowrap text-[11px] font-semibold"
                style={{
                  position: "absolute",
                  left: lbl.x,
                  top: Math.max(18, lbl.y),
                  transform: "translate(-50%, -100%)",
                  color: "#fff",
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  textShadow: "0 0 3px #000, 0 1px 2px #000, 0 -1px 2px #000",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                {lbl.name}
              </span>
            );
          }
          const bg =
            lbl.role === "a" ? COLOR_A : lbl.role === "b" ? COLOR_B : "rgba(8,12,20,0.92)";
          const color = lbl.role === "a" || lbl.role === "b" ? "#0b1f3a" : "#fff";
          return (
            <button
              key={lbl.key}
              type="button"
              className="whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold shadow-md"
              style={{
                position: "absolute",
                left: lbl.x,
                top: Math.max(18, lbl.y),
                transform: "translate(-50%, -100%)",
                background: bg,
                color,
                border: "1px solid rgba(255,255,255,0.25)",
                pointerEvents: lbl.siteId ? "auto" : "none",
                zIndex: 2,
              }}
              onClick={() => lbl.siteId && onSelect(lbl.siteId)}
            >
              {lbl.name}
            </button>
          );
        })}
      </div>

      <div
        className="flex flex-col items-end gap-1.5"
        style={{ position: "absolute", right: 12, top: 12, zIndex: 20 }}
      >
        <label className="flex cursor-pointer items-center gap-2 rounded bg-black/80 px-2.5 py-1.5 text-xs text-white shadow">
          <input
            type="checkbox"
            className="accent-[#f2d27a]"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
          />
          <span>{t("showNames")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded bg-black/80 px-2.5 py-1.5 text-xs text-white shadow">
          <input
            type="checkbox"
            className="accent-[#7ec8ff]"
            checked={showCraters}
            onChange={(e) => setShowCraters(e.target.checked)}
          />
          <span>{t("showCraters")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded bg-black/80 px-2.5 py-1.5 text-xs text-white shadow">
          <input
            type="checkbox"
            className="accent-[#c4a574]"
            checked={showRelief}
            onChange={(e) => setShowRelief(e.target.checked)}
            disabled={!!offline}
          />
          <span>{t("showRelief")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded bg-black/80 px-2.5 py-1.5 text-xs text-white shadow">
          <input
            type="checkbox"
            className="accent-[#ffcc33]"
            checked={showSky}
            onChange={(e) => setShowSky(e.target.checked)}
          />
          <span>{t("showSkyBodies")}</span>
        </label>
      </div>

      {showSky && (
        <div
          className="rounded bg-black/85 px-2.5 py-2 text-xs text-white shadow"
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 20,
            width: "min(260px, calc(100% - 160px))",
            pointerEvents: "auto",
          }}
        >
          <div className="mb-1 font-semibold text-[#f2d27a]">{t("skyEpoch")}</div>
          <input
            type="datetime-local"
            className="w-full rounded border border-white/20 bg-black/60 px-2 py-1 text-[11px] text-white"
            value={(skyTime || "2026-11-15T00:00:00Z").slice(0, 16)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onSkyTimeChange?.(`${v}:00Z`);
            }}
          />
          {compareStart && onSkyTimeChange && (
            <button
              type="button"
              className="mt-1.5 text-[10px] text-[#7ec8ff] underline"
              onClick={() => onSkyTimeChange(compareStart)}
            >
              {t("skySyncStart")}
            </button>
          )}
          <div className="mt-1.5 text-[10px] text-white/45">
            {t("skyObserver")}{" "}
            <span
              style={{
                color: skyObserver?.slot === "b" ? COLOR_B : COLOR_A,
                fontWeight: 700,
              }}
            >
              {skyObserver?.slot === "b" ? "B" : "A"}
            </span>
            {skyObserver?.name ? ` · ${skyObserver.name}` : ""}
          </div>
          {skyBusy && <div className="mt-1 text-[10px] text-white/55">{t("skyLoading")}</div>}
          {skyError && <div className="mt-1 text-[10px] text-red-300">{skyError}</div>}
          {sky && !skyBusy && (
            <div className="mt-1.5 space-y-0.5 text-[10px] leading-snug text-white/80">
              <div>
                <span style={{ color: COLOR_SUN }}>{t("skySun")}</span>
                {": "}
                {sky.sun.elevation_deg != null ? `${sky.sun.elevation_deg.toFixed(2)}°` : "—"}
                {" · "}
                {sky.sun.above_horizon ? t("skyAbove") : t("skyBelow")}
              </div>
              <div>
                <span style={{ color: COLOR_EARTH }}>{t("skyEarth")}</span>
                {": "}
                {sky.earth.elevation_deg != null ? `${sky.earth.elevation_deg.toFixed(2)}°` : "—"}
                {" · "}
                {sky.earth.above_horizon ? t("skyAbove") : t("skyBelow")}
              </div>
              <div className="pt-0.5 text-white/40">{t("skySpaceHint")}</div>
            </div>
          )}
        </div>
      )}

      {/* Navigation pad + zoom — inside the map frame */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 20,
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px 36px 36px",
            gridTemplateRows: "36px 36px 36px",
            gap: 4,
          }}
        >
          <span />
          <button type="button" style={navBtnStyle} aria-label={t("navUp")} title={t("navUp")} onClick={() => pan("up")}>
            ▲
          </button>
          <span />
          <button type="button" style={navBtnStyle} aria-label={t("navLeft")} title={t("navLeft")} onClick={() => pan("left")}>
            ◀
          </button>
          <button type="button" style={navBtnStyle} aria-label={t("navHome")} title={t("navHome")} onClick={resetView}>
            ⌂
          </button>
          <button type="button" style={navBtnStyle} aria-label={t("navRight")} title={t("navRight")} onClick={() => pan("right")}>
            ▶
          </button>
          <span />
          <button type="button" style={navBtnStyle} aria-label={t("navDown")} title={t("navDown")} onClick={() => pan("down")}>
            ▼
          </button>
          <span />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button type="button" style={navBtnStyle} aria-label={t("navZoomIn")} title={t("navZoomIn")} onClick={() => zoom("in")}>
            +
          </button>
          <button type="button" style={navBtnStyle} aria-label={t("navZoomOut")} title={t("navZoomOut")} onClick={() => zoom("out")}>
            −
          </button>
        </div>
      </div>

      <div
        className="max-w-[55%] rounded bg-black/70 px-2 py-1 text-[11px] text-white/85"
        style={{ position: "absolute", left: 12, bottom: 12, zIndex: 20, pointerEvents: "none" }}
      >
        {error || phase === "failed" ? (
          <span className="text-red-300">
            {t("mapFailed")}
            {error ? `: ${error}` : ""}
          </span>
        ) : (
          <>
            {t("mapCredit")}
            {offline ? ` · ${t("mapOffline")}` : ""} ·{" "}
            {phase === "loading" ? t("mapLoading") : t("mapReady")}
          </>
        )}
      </div>
    </div>
  );
}
