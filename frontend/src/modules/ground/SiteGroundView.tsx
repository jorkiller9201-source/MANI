"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dataApi, type SkySnapshot } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { MOON_SCENE_FAR_M } from "@/modules/moon/celestial";
import {
  createLolaTerrainProvider,
  GROUND_LOLA_EXAGGERATION,
  GROUND_LOLA_MAX_LEVEL,
} from "@/modules/moon/lolaTerrain";

const TREK_WAC =
  "/moon-tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg";
const TREK_LOLA_RELIEF =
  "/moon-tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png";

/**
 * Eye standing ON LOLA DEM (AGL ~120 m). DEM mounts from boot; one timed height sample
 * places the camera. Load gate never waits forever for tile queue=0; wall-clock forces 100%.
 */
const EYE_HEIGHT_M = 120;
/** One-shot sampleHeightMostDetailed — never from tileLoad / preRender loops. */
const TERRAIN_SAMPLE_TIMEOUT_MS = 2800;
/**
 * Wall-clock max from Viewer create. Must not depend on tileLoadProgressEvent hitting 0
 * (DEM/tile storms can freeze the main thread before a late timeout fires).
 */
const LOAD_GATE_TIMEOUT_MS = 8_000;
/** Artificial bar creep after 55% so the UI never looks frozen while tiles settle. */
const PROGRESS_SMOOTH_INTERVAL_MS = 200;
/** After camera+height, allow reveal without waiting for DEM tile idle. */
const TILE_IDLE_SOFT_MS = 1200;
/** Fade-out duration before the simulation is interactive. */
const LOAD_FADE_MS = 480;
/**
 * Cesium SkyBox scales its cube by frustum.far; 50 km clips the starfield to a black void.
 * Match MoonMap's far band so stars render; keep near>0 (NaN near → Invalid array length).
 */
const GROUND_NEAR_M = 1;
const GROUND_FAR_M = MOON_SCENE_FAR_M;
const GROUND_MAX_FAR_NEAR = MOON_SCENE_FAR_M * 2;
const BODY_RANGE_M = 25_000;
/** Soft pin tolerance — only rewrite camera.position if SSC drifted this far (m). */
const EYE_DRIFT_M = 2;
/** Minimum screen separation between Sol and Tierra HUD marks (px). */
const HUD_SEP_PX = 64;
const RENDER_RECOVERY_COOLDOWN_MS = 1500;

type Props = {
  open: boolean;
  onClose: () => void;
  slot: "a" | "b";
  name: string;
  lat: number;
  lon: number;
  siteId?: string | null;
  elevKm?: number;
  startIso: string;
  endIso: string;
  /** Full-tab page (default) vs legacy overlay chrome. Eye opens a new tab. */
  variant?: "page" | "modal";
  /** Label for the close control (page: close tab / back). */
  closeLabel?: string;
};

function parseIso(iso: string): number {
  return new Date(iso.replace("Z", "+00:00")).getTime();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function moonEllipsoidOf(Cesium: any) {
  return Cesium.Ellipsoid.MOON || new Cesium.Ellipsoid(1737400.0, 1737400.0, 1737400.0);
}

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

function makeDisc(color: string, size = 64): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
}

/** Horizons az/elev → world point along local ENU ray from observer. */
function bodyWorldFromAzEl(
  Cesium: any,
  ellipsoid: any,
  lon: number,
  lat: number,
  heightM: number,
  azDeg: number,
  elevDeg: number,
  rangeM: number
) {
  const origin = Cesium.Cartesian3.fromDegrees(lon, lat, heightM, ellipsoid);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);
  const az = Cesium.Math.toRadians(azDeg);
  const el = Cesium.Math.toRadians(elevDeg);
  const local = new Cesium.Cartesian3(
    Math.cos(el) * Math.sin(az),
    Math.cos(el) * Math.cos(az),
    Math.sin(el)
  );
  Cesium.Cartesian3.normalize(local, local);
  Cesium.Cartesian3.multiplyByScalar(local, rangeM, local);
  return Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
}

function projectWorld(viewer: any, Cesium: any, world: any) {
  try {
    const p =
      viewer.scene.cartesianToCanvasCoordinates?.(world) ||
      Cesium.SceneTransforms?.worldToWindowCoordinates?.(viewer.scene, world);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const w = viewer.scene.canvas.clientWidth;
    const h = viewer.scene.canvas.clientHeight;
    if (p.x < -100 || p.y < -100 || p.x > w + 100 || p.y > h + 100) return null;
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

/** Push Sol/Tierra apart on screen when Horizons places them near each other. */
function separateScreenMarks(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
  minDist: number
) {
  if (!a || !b) return;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= minDist) return;
  const push = (minDist - dist) / 2 + 6;
  if (dist < 1e-3) {
    a.x += push;
    a.y -= push * 0.35;
    b.x -= push;
    b.y += push * 0.35;
    return;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  a.x += nx * push;
  a.y += ny * push;
  b.x -= nx * push;
  b.y -= ny * push;
}

export default function SiteGroundView({
  open,
  onClose,
  slot,
  name,
  lat,
  lon,
  siteId,
  elevKm = 0,
  startIso,
  endIso,
  variant = "page",
  closeLabel,
}: Props) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const sunHudRef = useRef<HTMLDivElement>(null);
  const earthHudRef = useRef<HTMLDivElement>(null);
  const sunLabelRef = useRef<HTMLSpanElement>(null);
  const earthLabelRef = useRef<HTMLSpanElement>(null);
  const headingLabelRef = useRef<HTMLSpanElement>(null);

  const [ready, setReady] = useState(false);
  /** 0–100 load gate; one-shot — does not rewind after reveal. */
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFading, setLoadFading] = useState(false);
  const [simRevealed, setSimRevealed] = useState(false);
  const [error, setError] = useState("");
  /** Brief note when DEM had to be stripped as last-resort recovery. */
  const [terrainNote, setTerrainNote] = useState("");
  const [sky, setSky] = useState<SkySnapshot | null>(null);
  const skyRef = useRef<SkySnapshot | null>(null);
  const [demHeightM, setDemHeightM] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const eyeHeightRef = useRef((elevKm || 0) * 1000 + EYE_HEIGHT_M);

  const t0 = useMemo(() => parseIso(startIso), [startIso]);
  const t1 = useMemo(
    () => Math.max(parseIso(endIso), parseIso(startIso) + 3600_000),
    [endIso, startIso]
  );
  const [timeMs, setTimeMs] = useState(t0);

  useEffect(() => {
    if (open) setTimeMs(t0);
  }, [open, t0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Boot Cesium first-person globe at the site
  useEffect(() => {
    if (!open) return;
    let destroyed = false;
    let resizeObs: ResizeObserver | null = null;
    let gateTimer: number | undefined;
    let tileSettleTimer: number | undefined;
    let progressTickTimer: number | undefined;
    let softIdleTimer: number | undefined;

    async function boot() {
      setReady(false);
      setLoadProgress(0);
      setLoadFading(false);
      setSimRevealed(false);
      setError("");
      setTerrainNote("");
      try {
        let demH: number | null = null;
        try {
          const h = await dataApi.horizon({ lat, lon, site_id: siteId });
          if (h.dem_height_m != null && Number.isFinite(h.dem_height_m)) demH = h.dem_height_m;
          if (!destroyed) setDemHeightM(demH);
        } catch {
          /* terrain still works without mask metadata */
        }

        (window as any).CESIUM_BASE_URL = "/cesium/";
        ensureCss("/cesium/Widgets/widgets.css", "cesium-widgets-css");
        await loadScript("/cesium/Cesium.js");
        if (destroyed || !containerRef.current) return;
        const Cesium = (window as any).Cesium;
        const moonEllipsoid = moonEllipsoidOf(Cesium);

        // --- One-shot load gate (progress 0→100, then reveal once) ---
        const loadBits = {
          script: true,
          viewer: false,
          imagery: false,
          dem: false,
          camera: false,
          height: false,
          tilesIdle: false,
        };
        let tilePeak = 0;
        let tileRemaining = -1;
        let everTilePending = false;
        let gateDone = false;
        let shownPct = 0;
        let sscRef: any = null;
        let terrainStripped = false;
        let demMaxLevel = GROUND_LOLA_MAX_LEVEL;
        let demExaggeration = GROUND_LOLA_EXAGGERATION;
        let placeCameraFn: ((surfaceHm?: number, preserveLook?: boolean) => void) | null = null;
        let stripToEllipsoidFn: (() => void) | null = null;
        let remountDemFn: ((maxLevel: number, exaggeration: number) => boolean) | null = null;

        const clearGateTimers = () => {
          if (gateTimer != null) {
            window.clearTimeout(gateTimer);
            gateTimer = undefined;
          }
          if (tileSettleTimer != null) {
            window.clearTimeout(tileSettleTimer);
            tileSettleTimer = undefined;
          }
          if (progressTickTimer != null) {
            window.clearInterval(progressTickTimer);
            progressTickTimer = undefined;
          }
          if (softIdleTimer != null) {
            window.clearTimeout(softIdleTimer);
            softIdleTimer = undefined;
          }
        };

        const stageBase = () => {
          let p = 4;
          if (loadBits.script) p = 12;
          if (loadBits.viewer) p = 20;
          if (loadBits.imagery) p = 28;
          if (loadBits.dem) p = 36;
          if (loadBits.camera) p = 48;
          if (loadBits.height) p = 58;
          return p;
        };

        const computePct = () => {
          if (gateDone) return 100;
          if (loadBits.tilesIdle && loadBits.camera && loadBits.height) return 100;
          const base = stageBase();
          if (!loadBits.camera || tilePeak <= 0 || tileRemaining < 0) return base;
          const frac = 1 - Math.min(1, tileRemaining / tilePeak);
          return Math.min(98, Math.max(base, 58 + frac * 40));
        };

        const pushProgress = () => {
          const p = Math.round(computePct());
          if (p > shownPct) {
            shownPct = p;
            if (!destroyed) setLoadProgress(shownPct);
          }
        };

        /** Never leave the bar stuck while waiting on remaining DEM/imagery tiles. */
        const startSmoothProgress = () => {
          if (progressTickTimer != null || gateDone) return;
          progressTickTimer = window.setInterval(() => {
            if (gateDone || destroyed) {
              if (progressTickTimer != null) {
                window.clearInterval(progressTickTimer);
                progressTickTimer = undefined;
              }
              return;
            }
            if (!loadBits.height || shownPct >= 95) return;
            const next = Math.min(95, shownPct + 4);
            if (next > shownPct) {
              shownPct = next;
              if (!destroyed) setLoadProgress(shownPct);
            }
          }, PROGRESS_SMOOTH_INTERVAL_MS);
        };

        const finishLoadGate = () => {
          if (gateDone || destroyed) return;
          gateDone = true;
          clearGateTimers();
          shownPct = 100;
          if (!destroyed) setLoadProgress(100);
          try {
            if (sscRef) sscRef.enableLook = true;
          } catch {
            /* ignore */
          }
          if (!destroyed) {
            setLoadFading(true);
            window.setTimeout(() => {
              if (!destroyed) setSimRevealed(true);
            }, LOAD_FADE_MS);
          }
        };

        /** Reveal once camera is on terrain + height settled; tiles may keep loading. */
        const tryFinishGate = () => {
          if (gateDone || destroyed) return;
          if (!loadBits.camera || !loadBits.height || !loadBits.imagery) return;
          if (loadBits.tilesIdle) {
            finishLoadGate();
            return;
          }
          // Soft path: do not wait for DEM tile queue=0.
          if (softIdleTimer == null) {
            softIdleTimer = window.setTimeout(() => {
              softIdleTimer = undefined;
              if (gateDone || destroyed) return;
              loadBits.tilesIdle = true;
              pushProgress();
              tryFinishGate();
            }, TILE_IDLE_SOFT_MS);
          }
        };

        const forceFinishGate = () => {
          if (gateDone || destroyed) return;
          if (!loadBits.camera) {
            try {
              placeCameraFn?.();
            } catch {
              /* ignore */
            }
          }
          loadBits.height = true;
          loadBits.tilesIdle = true;
          pushProgress();
          finishLoadGate();
        };

        const markHeightDone = () => {
          if (gateDone) return;
          loadBits.height = true;
          pushProgress();
          startSmoothProgress();
          tryFinishGate();
        };

        pushProgress();

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
          orderIndependentTranslucency: false,
          contextOptions: { webgl: { alpha: false, preserveDrawingBuffer: true } },
        });
        if (destroyed) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;
        loadBits.viewer = true;
        pushProgress();

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#6a6a6a");
        viewer.scene.globe.showGroundAtmosphere = false;
        // Ground + low Sun: DirectionalLight night side reads as a black slab over terrain.
        // Keep unlit imagery; stars come from SkyBox (needs MOON_SCENE_FAR_M, not 50 km).
        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.dynamicAtmosphereLighting = false;
        // Depth-test vs terrain at eye height often eats the near mesh; keep off for ground view.
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.fog.enabled = false;
        if (typeof viewer.shadows === "boolean") viewer.shadows = false;
        if (viewer.scene.shadowMap) viewer.scene.shadowMap.enabled = false;
        if (typeof viewer.scene.highDynamicRange === "boolean") {
          viewer.scene.highDynamicRange = false;
        }
        // Log depth + tight near/far is fine; crash was NaN camera direction, not the ratio alone.
        if (typeof viewer.scene.logarithmicDepthBuffer === "boolean") {
          viewer.scene.logarithmicDepthBuffer = true;
        }

        /**
         * Assert a sane PerspectiveFrustum. Cesium defaults (near=0.1, far=1e10) are OK with
         * log-depth, but NaN/≤0 near from a broken camera → updateFrustums Invalid array length.
         */
        const lockGroundFrustum = () => {
          const fr = viewer.camera?.frustum;
          if (!fr) return;
          // Always force the ground band — never trust leftovers from multi-frustum or defaults.
          fr.near = GROUND_NEAR_M;
          fr.far = GROUND_FAR_M;
          if (!(fr.near > 0) || !(fr.far > fr.near) || fr.far / fr.near > GROUND_MAX_FAR_NEAR) {
            fr.near = GROUND_NEAR_M;
            fr.far = GROUND_FAR_M;
          }
          const canvas = viewer.scene?.canvas;
          if (typeof fr.aspectRatio === "number" && canvas) {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (w > 1 && h > 1) fr.aspectRatio = w / h;
          }
        };

        // Prefer an explicit perspective frustum once (do not fight orbit far-plane helpers).
        if (Cesium.PerspectiveFrustum && viewer.camera?.frustum) {
          try {
            const canvas = viewer.scene.canvas;
            const pf = new Cesium.PerspectiveFrustum();
            pf.fov = Cesium.Math.toRadians(70);
            pf.aspectRatio =
              Math.max(2, canvas?.clientWidth || 2) / Math.max(2, canvas?.clientHeight || 2);
            pf.near = GROUND_NEAR_M;
            pf.far = GROUND_FAR_M;
            viewer.camera.frustum = pf;
          } catch {
            lockGroundFrustum();
          }
        } else {
          lockGroundFrustum();
        }

        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
        if (viewer.scene.moon) viewer.scene.moon.show = false;
        // Coarser mesh near the eye — less imagery/globe subdivision thrash.
        if (typeof viewer.scene.globe.maximumScreenSpaceError === "number") {
          viewer.scene.globe.maximumScreenSpaceError = 16;
        }

        const moonTiling = () =>
          new Cesium.GeographicTilingScheme({
            ellipsoid: moonEllipsoid,
            numberOfLevelZeroTilesX: 2,
            numberOfLevelZeroTilesY: 1,
          });

        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: TREK_WAC,
            maximumLevel: 6,
            credit: new Cesium.Credit("NASA Moon Trek / LRO WAC"),
            tilingScheme: moonTiling(),
          })
        );
        const relief = viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: TREK_LOLA_RELIEF,
            maximumLevel: 4,
            credit: new Cesium.Credit("NASA Moon Trek / LRO LOLA"),
            tilingScheme: moonTiling(),
          })
        );
        relief.alpha = 0.55;
        // Slight lift so WAC/LOLA stay legible without globe lighting.
        try {
          const wac = viewer.imageryLayers.get(0);
          if (wac && typeof wac.brightness === "number") wac.brightness = 1.15;
          if (typeof relief.brightness === "number") relief.brightness = 1.1;
        } catch {
          /* older Cesium */
        }

        const applyEllipsoidTerrain = () => {
          if (Cesium.EllipsoidTerrainProvider) {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider({
              ellipsoid: moonEllipsoid,
            });
          }
          if (typeof viewer.scene.globe.terrainExaggeration === "number") {
            viewer.scene.globe.terrainExaggeration = 1;
          }
        };

        /** Mount / remount LOLA DEM. Prefer staying on terrain; ellipsoid only as last resort. */
        const remountDem = (maxLevel: number, exaggeration: number): boolean => {
          if (destroyed || viewer.isDestroyed?.() || terrainStripped) return false;
          try {
            const lolaTerrain = createLolaTerrainProvider(Cesium, moonEllipsoid, maxLevel);
            if (!lolaTerrain) return false;
            demMaxLevel = maxLevel;
            demExaggeration = exaggeration;
            viewer.terrainProvider = lolaTerrain;
            if (typeof viewer.scene.globe.terrainExaggeration === "number") {
              viewer.scene.globe.terrainExaggeration = exaggeration;
            }
            viewer.scene.requestRender();
            return true;
          } catch {
            return false;
          }
        };
        remountDemFn = remountDem;

        stripToEllipsoidFn = () => {
          if (terrainStripped || destroyed || viewer.isDestroyed?.()) return;
          terrainStripped = true;
          try {
            applyEllipsoidTerrain();
            viewer.scene.requestRender();
            if (!destroyed) setTerrainNote(tRef.current("groundTerrainFallback"));
          } catch {
            /* ignore */
          }
        };

        // LOLA DEM from the start — eye must stand on 3D relief, not flat ellipsoid.
        const demOk = remountDem(demMaxLevel, demExaggeration);
        if (!demOk) {
          applyEllipsoidTerrain();
          if (!destroyed) setTerrainNote(tRef.current("groundTerrainFallback"));
        }
        loadBits.dem = true;
        loadBits.imagery = true;
        pushProgress();

        // Invisible anchors for world positions (HUD draws the visible Sol/Tierra).
        viewer.entities.add({
          id: "ground_sun",
          position: Cesium.Cartesian3.ZERO,
          show: true,
          billboard: { show: false, image: makeDisc("#ffcc33", 64) },
          label: { show: false, text: tRef.current("skySun") },
        });
        viewer.entities.add({
          id: "ground_earth",
          position: Cesium.Cartesian3.ZERO,
          show: true,
          billboard: { show: false, image: makeDisc("#5b9fd4", 64) },
          label: { show: false, text: tRef.current("skyEarth") },
        });

        // Fixed standing point: look only (no walk / pan / dolly). Look stays off until load gate.
        const ssc = viewer.scene.screenSpaceCameraController;
        sscRef = ssc;
        ssc.enableCollisionDetection = false;
        ssc.enableTranslate = false;
        ssc.enableZoom = false;
        ssc.enableRotate = false;
        ssc.enableTilt = false;
        ssc.enableLook = false;
        ssc.inertiaSpin = 0;
        ssc.inertiaTranslate = 0;
        ssc.inertiaZoom = 0;
        ssc.maximumZoomDistance = 50;
        ssc.minimumZoomDistance = 1;
        ssc.lookEventTypes = [
          Cesium.CameraEventType.LEFT_DRAG,
          Cesium.CameraEventType.RIGHT_DRAG,
          Cesium.CameraEventType.MIDDLE_DRAG,
        ];

        const eyeFixed = new Cesium.Cartesian3();
        const eyeEnu = new Cesium.Matrix4();
        const scratchDir = new Cesium.Cartesian3();
        const scratchUp = new Cesium.Cartesian3();
        const scratchLocalDir = new Cesium.Cartesian3();
        const scratchLocalUp = new Cesium.Cartesian3();
        let eyeReady = false;
        const PITCH_MIN = Cesium.Math.toRadians(-75);
        const PITCH_MAX = Cesium.Math.toRadians(28);
        let lastHeadingUi = -999;
        let placedHeading = 0;
        let placedPitch = Cesium.Math.toRadians(-6);
        let renderRecoveries = 0;
        let lastRenderRecoveryMs = 0;
        let frustumHoldFrames = 0;
        let lastNanRecoverMs = 0;
        /** Wall-clock from Viewer create — always reveal even if tiles never idle. */
        gateTimer = window.setTimeout(forceFinishGate, LOAD_GATE_TIMEOUT_MS);

        /**
         * Initial / recovery pose only — NEVER call from preRender every frame.
         * lookAtTransform(..., range=0) → NaN direction → Invalid array length.
         */
        const applyEyeFrame = (heading: number, pitch: number) => {
          const h = Number.isFinite(heading) ? heading : 0;
          const p = Cesium.Math.clamp(
            Number.isFinite(pitch) ? pitch : Cesium.Math.toRadians(-6),
            PITCH_MIN,
            PITCH_MAX
          );
          Cesium.Transforms.eastNorthUpToFixedFrame(eyeFixed, moonEllipsoid, eyeEnu);
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          viewer.camera.constrainedAxis = undefined;

          const cosPitch = Math.cos(p);
          const sinPitch = Math.sin(p);
          const sinH = Math.sin(h);
          const cosH = Math.cos(h);
          scratchLocalDir.x = sinH * cosPitch;
          scratchLocalDir.y = cosH * cosPitch;
          scratchLocalDir.z = sinPitch;
          scratchLocalUp.x = -sinH * sinPitch;
          scratchLocalUp.y = -cosH * sinPitch;
          scratchLocalUp.z = cosPitch;

          Cesium.Matrix4.multiplyByPointAsVector(eyeEnu, scratchLocalDir, scratchDir);
          Cesium.Matrix4.multiplyByPointAsVector(eyeEnu, scratchLocalUp, scratchUp);
          if (
            !Cesium.Cartesian3.equalsEpsilon(scratchDir, Cesium.Cartesian3.ZERO, Cesium.Math.EPSILON8)
          ) {
            Cesium.Cartesian3.normalize(scratchDir, scratchDir);
          } else {
            Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_X, scratchDir);
          }
          if (
            !Cesium.Cartesian3.equalsEpsilon(scratchUp, Cesium.Cartesian3.ZERO, Cesium.Math.EPSILON8)
          ) {
            Cesium.Cartesian3.normalize(scratchUp, scratchUp);
          } else {
            Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_Z, scratchUp);
          }

          viewer.camera.setView({
            destination: eyeFixed,
            orientation: { direction: scratchDir, up: scratchUp },
          });
          lockGroundFrustum();
        };

        /**
         * Cheap per-frame work: soft-pin position, pitch nudge via lookUp, DOM heading.
         * No setView, no setState, no height sampling, no tile work.
         */
        const lockPose = () => {
          if (!eyeReady || destroyed || viewer.isDestroyed?.()) return;
          try {
            // Frustum only every ~30 frames — not every preRender.
            if (++frustumHoldFrames >= 30) {
              frustumHoldFrames = 0;
              lockGroundFrustum();
            }

            const cam = viewer.camera;
            if (cam.transform && !Cesium.Matrix4.equals(cam.transform, Cesium.Matrix4.IDENTITY)) {
              cam.lookAtTransform(Cesium.Matrix4.IDENTITY);
            }

            const drift = Cesium.Cartesian3.distance(cam.position, eyeFixed);
            if (Number.isFinite(drift) && drift > EYE_DRIFT_M) {
              Cesium.Cartesian3.clone(eyeFixed, cam.position);
            }

            const dir = cam.directionWC;
            if (
              !dir ||
              !Number.isFinite(dir.x) ||
              !Number.isFinite(dir.y) ||
              !Number.isFinite(dir.z)
            ) {
              // Rare recovery only — never spam setView from preRender.
              const now = Date.now();
              if (now - lastNanRecoverMs > RENDER_RECOVERY_COOLDOWN_MS) {
                lastNanRecoverMs = now;
                applyEyeFrame(placedHeading, placedPitch);
              }
              return;
            }

            let pitch = cam.pitch;
            if (!Number.isFinite(pitch)) pitch = placedPitch;
            if (pitch < PITCH_MIN) {
              cam.lookUp(PITCH_MIN - pitch);
            } else if (pitch > PITCH_MAX) {
              cam.lookUp(-(pitch - PITCH_MAX));
            }

            let heading = cam.heading;
            if (!Number.isFinite(heading)) heading = 0;
            const deg = Cesium.Math.toDegrees(heading);
            if (Math.abs(deg - lastHeadingUi) >= 2) {
              lastHeadingUi = deg;
              if (headingLabelRef.current) {
                headingLabelRef.current.textContent = `${deg.toFixed(0)}°`;
              }
            }
          } catch {
            /* ignore */
          }
        };

        const apiFallbackH = demH ?? elevKm * 1000;
        let initialPlaceDone = false;

        /**
         * Place at surface + eye AGL (~120 m). Catalog first, then one timed DEM sample.
         * Never call from tileLoad / preRender loops.
         */
        const placeCamera = (surfaceHm?: number, preserveLook = false) => {
          if (destroyed || viewer.isDestroyed?.()) return;
          const surfaceH =
            surfaceHm != null && Number.isFinite(surfaceHm)
              ? surfaceHm
              : Number.isFinite(apiFallbackH)
                ? apiFallbackH
                : 0;
          const eye = surfaceH + EYE_HEIGHT_M;
          if (!Number.isFinite(eye)) return;
          eyeHeightRef.current = eye;
          Cesium.Cartesian3.fromDegrees(lon, lat, eye, moonEllipsoid, eyeFixed);
          if (
            !Number.isFinite(eyeFixed.x) ||
            !Number.isFinite(eyeFixed.y) ||
            !Number.isFinite(eyeFixed.z)
          ) {
            return;
          }
          if (!preserveLook || !initialPlaceDone) {
            placedHeading = 0;
            placedPitch = Cesium.Math.toRadians(-6);
            lastHeadingUi = 0;
            if (headingLabelRef.current) headingLabelRef.current.textContent = "0°";
          } else {
            const h = viewer.camera.heading;
            const p = viewer.camera.pitch;
            if (Number.isFinite(h)) placedHeading = h;
            if (Number.isFinite(p)) {
              placedPitch = Cesium.Math.clamp(p, PITCH_MIN, PITCH_MAX);
            }
          }
          eyeReady = true;
          initialPlaceDone = true;
          applyEyeFrame(placedHeading, placedPitch);
          lockGroundFrustum();
          setReady(true);
          if (!loadBits.camera) {
            loadBits.camera = true;
            pushProgress();
          }
          viewer.scene.requestRender();
        };
        placeCameraFn = placeCamera;

        const clampCameraAfterError = () => {
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          viewer.camera.constrainedAxis = undefined;
          lockGroundFrustum();
          if (eyeReady) {
            const rawH = viewer.camera.heading;
            const rawP = viewer.camera.pitch;
            const h = Number.isFinite(rawH) ? rawH : placedHeading;
            const p = Number.isFinite(rawP) ? rawP : placedPitch;
            placedHeading = h;
            placedPitch = Cesium.Math.clamp(p, PITCH_MIN, PITCH_MAX);
            applyEyeFrame(placedHeading, placedPitch);
          } else {
            placeCamera();
          }
          const widget = viewer.cesiumWidget;
          if (widget && widget._useDefaultRenderLoop !== true) widget._useDefaultRenderLoop = true;
          const host = widget?._element ?? viewer.container;
          const panel = host?.querySelector?.(".cesium-widget-errorPanel");
          if (panel?.parentElement) panel.parentElement.removeChild(panel);
          viewer.scene.requestRender();
        };

        const onRenderError = () => {
          if (destroyed || viewer.isDestroyed?.()) return;
          const now = Date.now();
          if (now - lastRenderRecoveryMs < RENDER_RECOVERY_COOLDOWN_MS) {
            forceFinishGate();
            return;
          }
          lastRenderRecoveryMs = now;
          renderRecoveries += 1;

          try {
            // Prefer staying on terrain: clamp camera, then lower LOD / exaggeration.
            if (renderRecoveries === 1 && !terrainStripped) {
              if (typeof viewer.scene.globe.maximumScreenSpaceError === "number") {
                viewer.scene.globe.maximumScreenSpaceError = Math.max(
                  16,
                  viewer.scene.globe.maximumScreenSpaceError
                );
              }
              if (typeof viewer.scene.globe.terrainExaggeration === "number") {
                demExaggeration = Math.min(demExaggeration, 1.0);
                viewer.scene.globe.terrainExaggeration = demExaggeration;
              }
              clampCameraAfterError();
            } else if (renderRecoveries === 2 && !terrainStripped) {
              const lower = Math.max(3, Math.min(demMaxLevel, 4));
              remountDemFn?.(lower, 1.0);
              clampCameraAfterError();
            } else {
              // Last resort — strip DEM so the tab stays usable.
              stripToEllipsoidFn?.();
              clampCameraAfterError();
            }
          } catch {
            stripToEllipsoidFn?.();
          }
          forceFinishGate();
        };
        viewer.scene.renderError.addEventListener(onRenderError);
        (viewer as any).__maniGroundRenderError = onRenderError;

        // Catalog height first (safe eye), then ONE timed DEM sample — no tileLoad resample.
        placeCamera();

        void (async () => {
          let sampled: number | null = null;
          try {
            if (!terrainStripped && demOk) {
              const carto = Cesium.Cartographic.fromDegrees(lon, lat);
              if (typeof viewer.scene.sampleHeightMostDetailed === "function") {
                const result = await Promise.race([
                  viewer.scene.sampleHeightMostDetailed([carto]),
                  new Promise<null>((r) =>
                    setTimeout(() => r(null), TERRAIN_SAMPLE_TIMEOUT_MS)
                  ),
                ]);
                const h = Array.isArray(result) ? result[0]?.height : undefined;
                if (typeof h === "number" && Number.isFinite(h)) sampled = h;
              }
              if (
                sampled == null &&
                typeof viewer.scene.globe.getHeight === "function"
              ) {
                const gh = viewer.scene.globe.getHeight(carto);
                if (typeof gh === "number" && Number.isFinite(gh)) sampled = gh;
              }
            }
          } catch {
            /* catalog height already applied */
          }
          if (destroyed || viewer.isDestroyed?.()) return;
          // Refine eye even if the load gate already closed (tiles may still stream).
          if (sampled != null) {
            placeCamera(sampled, true);
            if (!destroyed) setDemHeightM(sampled);
          }
          markHeightDone();
        })();

        // Soft idle if Cesium never reports remaining===0 (DEM tiles may keep streaming).
        window.setTimeout(() => {
          if (gateDone || destroyed) return;
          if (!loadBits.camera || !loadBits.height || loadBits.tilesIdle) return;
          if (everTilePending && tileRemaining > 0) return;
          loadBits.tilesIdle = true;
          pushProgress();
          tryFinishGate();
        }, 1600);

        const onTileProgress = (remaining: number) => {
          if (gateDone || destroyed) return;
          const n = typeof remaining === "number" && Number.isFinite(remaining) ? remaining : 0;
          tileRemaining = n;
          if (n > tilePeak) tilePeak = n;
          if (n > 0) {
            everTilePending = true;
            if (tileSettleTimer != null) {
              window.clearTimeout(tileSettleTimer);
              tileSettleTimer = undefined;
            }
            // Do not clear tilesIdle forever — soft/wall timers still finish the gate.
          } else if (loadBits.camera && loadBits.height) {
            if (tileSettleTimer != null) window.clearTimeout(tileSettleTimer);
            tileSettleTimer = window.setTimeout(
              () => {
                if (gateDone || destroyed) return;
                loadBits.tilesIdle = true;
                pushProgress();
                tryFinishGate();
              },
              everTilePending ? 350 : 700
            );
          }
          pushProgress();
          tryFinishGate();
        };
        viewer.scene.globe.tileLoadProgressEvent.addEventListener(onTileProgress);
        (viewer as any).__maniGroundTileProgress = onTileProgress;

        viewer.scene.preRender.addEventListener(lockPose);
        (viewer as any).__maniGroundLockPose = lockPose;
        (viewer as any).__maniGroundEyeFixed = eyeFixed;
        (viewer as any).__maniGroundEyeHeight = () => eyeHeightRef.current;

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          resizeObs = new ResizeObserver(() => {
            try {
              if (viewer.isDestroyed?.()) return;
              const el = containerRef.current;
              if (!el || el.clientWidth < 2 || el.clientHeight < 2) return;
              viewer.resize();
              viewer.scene.requestRender();
            } catch {
              /* ignore */
            }
          });
          resizeObs.observe(containerRef.current);
        }
      } catch (e: unknown) {
        if (!destroyed) setError(e instanceof Error ? e.message : tRef.current("groundViewFailed"));
      }
    }

    boot();
    return () => {
      destroyed = true;
      if (gateTimer != null) window.clearTimeout(gateTimer);
      if (tileSettleTimer != null) window.clearTimeout(tileSettleTimer);
      if (progressTickTimer != null) window.clearInterval(progressTickTimer);
      if (softIdleTimer != null) window.clearTimeout(softIdleTimer);
      resizeObs?.disconnect();
      const v = viewerRef.current;
      if (v && !v.isDestroyed?.()) {
        try {
          if (v.__maniGroundLockPose) v.scene.preRender.removeEventListener(v.__maniGroundLockPose);
          if (v.__maniGroundRenderError) v.scene.renderError.removeEventListener(v.__maniGroundRenderError);
          if (v.__maniGroundTileProgress) {
            v.scene.globe.tileLoadProgressEvent.removeEventListener(v.__maniGroundTileProgress);
          }
          const Cesium = (window as any).Cesium;
          if (Cesium?.Matrix4) v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        } catch {
          /* ignore */
        }
        try {
          v.destroy();
        } catch {
          /* ignore */
        }
      }
      viewerRef.current = null;
      setReady(false);
      setLoadProgress(0);
      setLoadFading(false);
      setSimRevealed(false);
      setTerrainNote("");
    };
    // Intentionally omit `t` — remounting the Viewer on i18n churn wiped the globe.
  }, [open, lat, lon, siteId, elevKm]);

  // Fetch Horizons az/elev for the scrubbed UTC time (HUD Sol/Tierra only)
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    const elev =
      demHeightM != null && Number.isFinite(demHeightM) ? demHeightM / 1000 : elevKm;
    const iso = toIso(timeMs);
    dataApi
      .sky({ time: iso, lat, lon, elev_km: elev, site_id: siteId })
      .then((s) => {
        if (cancelled) return;
        skyRef.current = s;
        setSky(s);
        setError("");
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || viewer.isDestroyed?.() || !Cesium) return;

        // Do not apply DirectionalLight here — with enableLighting it paints the far
        // hemisphere pure black from ground level. Sun/Earth HUD still uses Horizons az/el.

        const ellipsoid = moonEllipsoidOf(Cesium);
        const eyeH = eyeHeightRef.current;

        const place = (id: string, body: SkySnapshot["sun"], range: number) => {
          const ent = viewer.entities.getById(id);
          if (!ent || body.azimuth_deg == null || body.elevation_deg == null) {
            if (ent) ent.show = false;
            return;
          }
          ent.show = true;
          ent.position = new Cesium.ConstantPositionProperty(
            bodyWorldFromAzEl(
              Cesium,
              ellipsoid,
              lon,
              lat,
              eyeH,
              body.azimuth_deg,
              body.elevation_deg,
              range
            )
          );
          if (ent.billboard) ent.billboard.show = false;
          if (ent.label) ent.label.show = false;
        };
        place("ground_sun", s.sun, BODY_RANGE_M);
        place("ground_earth", s.earth, BODY_RANGE_M * 0.92);
        viewer.scene.requestRender();
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : tRef.current("groundViewFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [open, ready, timeMs, lat, lon, elevKm, demHeightM, siteId]);

  // Project Sol/Tierra to HUD via DOM refs (no React setState; throttled ~10 Hz).
  useEffect(() => {
    if (!open || !ready) return;
    const viewer = viewerRef.current;
    const Cesium = (window as any).Cesium;
    if (!viewer || !Cesium) return;
    let raf = 0;
    let lastHudMs = 0;
    const HUD_MIN_MS = 100;

    const applyHud = (
      el: HTMLDivElement | null,
      labelEl: HTMLSpanElement | null,
      p: { x: number; y: number } | null,
      label: string,
      dimmed: boolean
    ) => {
      if (!el) return;
      if (!p) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.opacity = dimmed ? "0.35" : "1";
      if (labelEl) labelEl.textContent = label;
    };

    const tick = () => {
      const s = skyRef.current;
      if (!s || viewer.isDestroyed?.()) {
        applyHud(sunHudRef.current, sunLabelRef.current, null, "", false);
        applyHud(earthHudRef.current, earthLabelRef.current, null, "", false);
        return;
      }
      const ellipsoid = moonEllipsoidOf(Cesium);
      const eyeH = eyeHeightRef.current;
      const tt = tRef.current;

      let sunP: { x: number; y: number } | null = null;
      let earthP: { x: number; y: number } | null = null;
      let sunLabel = "";
      let earthLabel = "";
      let sunDim = false;
      let earthDim = false;

      if (s.sun.azimuth_deg != null && s.sun.elevation_deg != null) {
        const world = bodyWorldFromAzEl(
          Cesium,
          ellipsoid,
          lon,
          lat,
          eyeH,
          s.sun.azimuth_deg,
          s.sun.elevation_deg,
          BODY_RANGE_M
        );
        sunP = projectWorld(viewer, Cesium, world);
        sunLabel = `${tt("skySun")} ${s.sun.elevation_deg >= 0 ? "+" : ""}${s.sun.elevation_deg.toFixed(1)}°`;
        sunDim = s.sun.elevation_deg < 0;
      }
      if (s.earth.azimuth_deg != null && s.earth.elevation_deg != null) {
        const world = bodyWorldFromAzEl(
          Cesium,
          ellipsoid,
          lon,
          lat,
          eyeH,
          s.earth.azimuth_deg,
          s.earth.elevation_deg,
          BODY_RANGE_M * 0.92
        );
        earthP = projectWorld(viewer, Cesium, world);
        earthLabel = `${tt("skyEarth")} ${s.earth.elevation_deg >= 0 ? "+" : ""}${s.earth.elevation_deg.toFixed(1)}°`;
        earthDim = s.earth.elevation_deg < 0;
      }

      separateScreenMarks(sunP, earthP, HUD_SEP_PX);
      if (sunP && earthP && Math.hypot(sunP.x - earthP.x, sunP.y - earthP.y) < HUD_SEP_PX + 8) {
        sunP.y -= 18;
        earthP.y += 18;
      }

      applyHud(sunHudRef.current, sunLabelRef.current, sunP, sunLabel, sunDim);
      applyHud(earthHudRef.current, earthLabelRef.current, earthP, earthLabel, earthDim);
    };

    const onPost = () => {
      const now = performance.now();
      if (now - lastHudMs < HUD_MIN_MS) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        lastHudMs = performance.now();
        tick();
      });
    };
    viewer.scene.postRender.addEventListener(onPost);
    tick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        viewer.scene.postRender.removeEventListener(onPost);
      } catch {
        /* ignore */
      }
    };
  }, [open, ready, lat, lon]);

  useEffect(() => {
    if (!open || !playing) return;
    const id = window.setInterval(() => {
      setTimeMs((prev) => {
        const step = 30 * 60 * 1000; // 30 min steps for smoother live motion
        const next = prev + step;
        return next > t1 ? t0 : next;
      });
    }, 450);
    return () => window.clearInterval(id);
  }, [open, playing, t0, t1]);

  if (!open) return null;

  const accent = slot === "a" ? "#f2d27a" : "#7ec8ff";
  const progress = t1 > t0 ? (timeMs - t0) / (t1 - t0) : 0;
  const isPage = variant !== "modal";
  const closeText = closeLabel || (isPage ? t("groundCloseTab") : t("aboutClose"));

  const loadOverlay =
    !simRevealed && !error ? (
      <div
        className={`absolute inset-0 z-30 flex items-center justify-center transition-opacity ease-out ${
          loadFading ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
        style={{ background: "#05080c", transitionDuration: `${LOAD_FADE_MS}ms` }}
        aria-busy={!loadFading}
        aria-live="polite"
      >
        <div className="w-full max-w-sm px-8">
          <p className="mb-4 text-center text-sm text-white/75">{t("groundViewLoading3d")}</p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-sm bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loadProgress}
          >
            <div
              className="h-full rounded-sm transition-[width] duration-200 ease-out"
              style={{ width: `${loadProgress}%`, background: accent }}
            />
          </div>
          <p className="mt-3 text-center font-mono text-sm tabular-nums text-white/85">
            {loadProgress}%
          </p>
        </div>
      </div>
    ) : null;

  const hud = (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div
        ref={sunHudRef}
        className="absolute"
        style={{ display: "none", transform: "translate(-50%, -50%)" }}
      >
        <div
          className="mx-auto rounded-full"
          style={{
            width: 48,
            height: 48,
            background:
              "radial-gradient(circle at 35% 35%, #fff 0%, #ffcc33 45%, transparent 72%)",
            boxShadow: "0 0 24px #ffcc33",
          }}
        />
        <span
          ref={sunLabelRef}
          className="mt-1 block whitespace-nowrap text-center text-[11px] font-semibold"
          style={{ color: "#ffcc33", textShadow: "0 0 4px #000, 0 1px 2px #000" }}
        />
      </div>
      <div
        ref={earthHudRef}
        className="absolute"
        style={{ display: "none", transform: "translate(-50%, -50%)" }}
      >
        <div
          className="mx-auto rounded-full"
          style={{
            width: 36,
            height: 36,
            background:
              "radial-gradient(circle at 35% 35%, #fff 0%, #5b9fd4 45%, transparent 72%)",
            boxShadow: "0 0 18px #5b9fd4",
          }}
        />
        <span
          ref={earthLabelRef}
          className="mt-1 block whitespace-nowrap text-center text-[11px] font-semibold"
          style={{ color: "#5b9fd4", textShadow: "0 0 4px #000, 0 1px 2px #000" }}
        />
      </div>
    </div>
  );

  const controls = (
    <>
      <p className="text-[11px] text-white/45">
        {t("groundViewDragHint3d")} · {t("groundYaw")}:{" "}
        <span ref={headingLabelRef}>0°</span>
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-white/70">
          <span>{t("groundTimeStep")}</span>
          <span className="font-mono text-[#f2d27a]">
            {new Date(timeMs).toISOString().replace(".000Z", "Z")}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => {
            const p = Number(e.target.value) / 1000;
            setTimeMs(t0 + p * (t1 - t0));
            setPlaying(false);
          }}
          className="w-full accent-[#f2d27a]"
          aria-label={t("groundTimeStep")}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded border border-[#f2d27a]/50 px-3 py-1.5 text-xs text-[#f2d27a]"
          >
            {playing ? t("groundPause") : t("groundPlay")}
          </button>
          <span className="text-[11px] text-white/40">
            {startIso} → {endIso}
          </span>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {terrainNote && !error && (
        <p className="mt-2 text-[11px] text-amber-200/80">{terrainNote}</p>
      )}
      {sky && (
        <p className="mt-2 text-[11px] text-white/45">
          {t("groundSkySource")}: {sky.source || sky.mode} · NASA Moon Trek / LOLA DEM + shaded relief
        </p>
      )}
    </>
  );

  if (isPage) {
    return (
      <div
        className="flex h-screen flex-col overflow-hidden bg-[#071018] text-white"
        aria-label={t("groundViewTitle")}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold sm:text-xl" style={{ color: accent }}>
              {t("groundViewTitle")} · {slot.toUpperCase()}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/55">
              {name} · {lat.toFixed(4)}°, {lon.toFixed(4)}°
              {demHeightM != null ? ` · DEM ${demHeightM.toFixed(0)} m` : ""} · {t("groundViewLead3d")}
            </p>
          </div>
          <button type="button" className="mani-export__btn ghost shrink-0" onClick={onClose}>
            {closeText}
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-black">
          {/* Canvas stays mounted/sized so Cesium can load tiles under the opaque gate. */}
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />
          {simRevealed ? hud : null}
          {loadOverlay}
        </div>

        <footer className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6">{controls}</footer>
      </div>
    );
  }

  return (
    <div className="mani-history" role="dialog" aria-modal="true" aria-label={t("groundViewTitle")}>
      <div className="mani-history__backdrop" onClick={onClose} />
      <aside
        className="mani-history__panel"
        style={{ maxWidth: "min(56rem, 100%)", width: "min(56rem, 100%)" }}
      >
        <div className="mani-history__head">
          <div>
            <h2 style={{ color: accent }}>
              {t("groundViewTitle")} · {slot.toUpperCase()}
            </h2>
            <p>
              {name} · {lat.toFixed(4)}°, {lon.toFixed(4)}° · {t("groundViewLead3d")}
            </p>
          </div>
          <button type="button" className="mani-export__btn ghost" onClick={onClose}>
            {closeText}
          </button>
        </div>

        <div
          className="relative overflow-hidden rounded border border-white/15 bg-black"
          style={{ height: "min(56vh, 460px)" }}
        >
          <div ref={containerRef} className="h-full w-full" />
          {simRevealed ? hud : null}
          {loadOverlay}
        </div>

        <div className="mt-2">{controls}</div>
      </aside>
    </div>
  );
}
