/**
 * Moon-centered celestial poses via Cesium public ephemeris APIs
 * (Simon1994PlanetaryPositions + IauOrientationAxes), same stack as Scene/Moon.js.
 *
 * Our globe is Moon-fixed (Moon Trek), so Earth/Sun from Earth-fixed ICRF must be
 * transformed into the lunar body frame — the inverse of how Cesium places its Moon.
 */

export type CelestialPose = {
  /** Sun position in Moon body frame (meters from Moon center). */
  sunMoonFixed: any;
  /** Earth center in Moon body frame (meters). */
  earthMoonFixed: any;
  /** Unit direction Moon → Sun in Moon body frame. */
  sunDirection: any;
};

const scratchIcrf = { m: null as any };
const scratchRot = { m: null as any };
const scratchRt = { m: null as any };
const scratchMoon = { v: null as any };
const scratchSun = { v: null as any };
const scratchEarth = { v: null as any };
const scratchAxes = { a: null as any };

export function julianFromIso(Cesium: any, iso: string) {
  const d = new Date(iso);
  return Cesium.JulianDate.fromDate(d);
}

/**
 * Earth & Sun in the lunar body frame at `date` (JulianDate).
 */
export function celestialInMoonFrame(Cesium: any, date: any): CelestialPose | null {
  try {
    if (!scratchAxes.a) scratchAxes.a = new Cesium.IauOrientationAxes();
    if (!scratchIcrf.m) scratchIcrf.m = new Cesium.Matrix3();
    if (!scratchRot.m) scratchRot.m = new Cesium.Matrix3();
    if (!scratchRt.m) scratchRt.m = new Cesium.Matrix3();
    if (!scratchMoon.v) scratchMoon.v = new Cesium.Cartesian3();
    if (!scratchSun.v) scratchSun.v = new Cesium.Cartesian3();
    if (!scratchEarth.v) scratchEarth.v = new Cesium.Cartesian3();

    const icrfToFixed = scratchIcrf.m;
    if (!Cesium.Transforms.computeIcrfToFixedMatrix(date, icrfToFixed)) {
      Cesium.Transforms.computeTemeToPseudoFixedMatrix(date, icrfToFixed);
    }

    // Same composition as Cesium Scene/Moon.js → Moon-body to Earth-fixed
    const rotation = scratchRot.m;
    scratchAxes.a.evaluate(date, rotation);
    Cesium.Matrix3.transpose(rotation, rotation);
    Cesium.Matrix3.multiply(icrfToFixed, rotation, rotation);

    const moonInertial = Cesium.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
      date,
      scratchMoon.v
    );
    const moonEarthFixed = Cesium.Matrix3.multiplyByVector(icrfToFixed, moonInertial, moonInertial);

    const Rtranspose = Cesium.Matrix3.transpose(rotation, scratchRt.m);

    // Earth center in Moon body: -R^T * moon_earth_fixed
    const earthNeg = Cesium.Cartesian3.negate(moonEarthFixed, scratchEarth.v);
    const earthMoonFixed = Cesium.Matrix3.multiplyByVector(Rtranspose, earthNeg, earthNeg);
    // Rotation preserves |Moon–Earth| from Simon1994 (~3.84e8 m). Reject a bad frame.
    const earthRange = Cesium.Cartesian3.magnitude(earthMoonFixed);
    if (!(earthRange > 3.0e8 && earthRange < 5.0e8)) return null;

    const sunInertial = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
      date,
      scratchSun.v
    );
    const sunEarthFixed = Cesium.Matrix3.multiplyByVector(icrfToFixed, sunInertial, sunInertial);
    const sunFromMoonEF = Cesium.Cartesian3.subtract(sunEarthFixed, moonEarthFixed, sunEarthFixed);
    const sunMoonFixed = Cesium.Matrix3.multiplyByVector(Rtranspose, sunFromMoonEF, sunFromMoonEF);

    const sunDirection = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.clone(sunMoonFixed, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    return {
      sunMoonFixed: Cesium.Cartesian3.clone(sunMoonFixed, new Cesium.Cartesian3()),
      earthMoonFixed: Cesium.Cartesian3.clone(earthMoonFixed, new Cesium.Cartesian3()),
      sunDirection,
    };
  } catch {
    return null;
  }
}

/** ~1 AU — Cesium.Sun bounding volume lives here; frustum.far must exceed this. */
export const SUN_DISTANCE_M = 149_597_870_700;
/** Beyond 1 AU so the native Sun is never far-plane culled while orbiting. */
export const SPACE_FAR_PLANE_M = SUN_DISTANCE_M * 1.6;

export function ensureSpaceFarPlane(viewer: any) {
  const frustum = viewer?.camera?.frustum;
  if (frustum && typeof frustum.far === "number" && frustum.far < SPACE_FAR_PLANE_M) {
    frustum.far = SPACE_FAR_PLANE_M;
  }
}

const scratchSunAlong = { v: null as any };

/** Turn off Cesium's native Sun post-process (burst shader); safe on all GPUs. */
export function disableNativeCesiumSun(viewer: any) {
  const sun = viewer?.scene?.sun;
  if (!sun) return;
  sun.show = false;
  if (typeof sun.glowFactor === "number") sun.glowFactor = 0;
}

/**
 * Proactive off + soft recovery if a Sun draw still throws (e.g. shader compile).
 */
export function guardCesiumSunRenderErrors(viewer: any) {
  if (!viewer?.scene || viewer.__maniSunCrashGuard) return;
  viewer.__maniSunCrashGuard = true;
  disableNativeCesiumSun(viewer);
  viewer.scene.renderError.addEventListener(() => {
    disableNativeCesiumSun(viewer);
    viewer.scene.requestRender();
  });
}

/**
 * Install UniformState + Sun draw-command hooks so scene.sun tracks the Moon-frame
 * sun direction without vanishing at glancing frustum angles (south-pole limb).
 * Only use when native scene.sun is intentionally enabled (MANI uses billboard fallback).
 */
export function installMoonFrameSunHook(viewer: any, Cesium: any, getPose: () => CelestialPose | null) {
  const us = viewer.scene?.context?.uniformState;
  if (!us || us.__maniSunHook) return;
  if (!scratchSunAlong.v) scratchSunAlong.v = new Cesium.Cartesian3();

  const original = us.update.bind(us);
  us.update = function maniSunUpdate(frameState: any) {
    original(frameState);
    const pose = getPose();
    if (!pose) return;

    // Place the Sun on the camera→sun ray at 1 AU so angular size stays real,
    // while the bounding volume sits on a stable ray from the eye (not Moon center).
    const cam = viewer.camera.positionWC;
    Cesium.Cartesian3.multiplyByScalar(pose.sunDirection, SUN_DISTANCE_M, scratchSunAlong.v);
    Cesium.Cartesian3.add(cam, scratchSunAlong.v, this._sunPositionWC);
    Cesium.Cartesian3.clone(pose.sunDirection, this._sunDirectionWC);
    ensureSpaceFarPlane(viewer);
  };
  us.__maniSunHook = true;

  if (!viewer.__maniSunCullHook) {
    let sunRenderState: any = null;
    viewer.scene.preRender.addEventListener(() => {
      if (!getPose()) return;
      const sun = viewer.scene.sun;
      if (!sun) return;
      const cmd = sun._drawCommand;
      if (cmd) {
        // Tiny BV at ~1 AU is false-culled at the viewport edge / lunar limb.
        cmd.cull = false;
        // When the Sun crosses the Moon disk in screen space, default depth testing
        // deletes it instead of letting it sit behind the limb — keep the Cesium glow.
        if (!sunRenderState && Cesium.RenderState) {
          sunRenderState = Cesium.RenderState.fromCache({
            blending: Cesium.BlendingState?.ALPHA_BLEND,
            depthTest: { enabled: false },
            depthMask: false,
          });
        }
        if (sunRenderState) cmd.renderState = sunRenderState;
      }
      if (sun._boundingVolume) {
        sun._boundingVolume.radius = Math.max(sun._boundingVolume.radius || 0, SUN_DISTANCE_M * 0.05);
      }
      if (sun._boundingVolume2D) {
        sun._boundingVolume2D.radius = Math.max(sun._boundingVolume2D.radius || 0, SUN_DISTANCE_M * 0.05);
      }
    });
    viewer.__maniSunCullHook = true;
  }
}
