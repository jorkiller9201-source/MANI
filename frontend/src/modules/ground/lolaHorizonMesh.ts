/**
 * Local first-person relief from the LOLA topographic horizon mask.
 * Avoids CustomHeightmapTerrainProvider at eye height (Int32 / Invalid array length).
 */

const RING_RANGE_M = 6_000;
const INNER_RANGE_M = 180;
const GROUND_DISK_RADIUS_M = 90;
const MESH_EXAG = 1.15;

export type HorizonMeshInput = {
  lat: number;
  lon: number;
  demHeightM: number;
  horizonElevDeg: number[];
};

/** Flat standing pad at DEM height so the eye is clearly on a surface. */
export function addGroundDiskPrimitive(
  Cesium: any,
  ellipsoid: any,
  lat: number,
  lon: number,
  demHeightM: number
) {
  const h = Number.isFinite(demHeightM) ? demHeightM : 0;
  const positions: number[] = [];
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const east = Math.sin(a) * GROUND_DISK_RADIUS_M;
    const north = Math.cos(a) * GROUND_DISK_RADIUS_M;
    const origin = Cesium.Cartesian3.fromDegrees(lon, lat, h, ellipsoid);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);
    const local = new Cesium.Cartesian3(east, north, 0);
    const world = Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
    const c = Cesium.Cartographic.fromCartesian(world, ellipsoid);
    positions.push(
      Cesium.Math.toDegrees(c.longitude),
      Cesium.Math.toDegrees(c.latitude),
      h
    );
  }
  const hierarchy = new Cesium.PolygonHierarchy(
    Cesium.Cartesian3.fromDegreesArrayHeights(positions, ellipsoid)
  );
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: hierarchy,
        perPositionHeight: true,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString("#8a8680").withAlpha(0.95)
        ),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: false,
      closed: false,
    }),
    asynchronous: false,
  });
}

/**
 * 360° mountain ring: ridge height from LOLA horizon elev at fixed range.
 * Real south-pole silhouette without globe DEM subdivision.
 */
export function addHorizonRingPrimitive(
  Cesium: any,
  ellipsoid: any,
  input: HorizonMeshInput
) {
  const elevs = input.horizonElevDeg;
  if (!Array.isArray(elevs) || elevs.length < 8) return null;
  const demH = Number.isFinite(input.demHeightM) ? input.demHeightM : 0;
  const n = elevs.length;
  const top: number[] = [];
  const inner: number[] = [];

  for (let i = 0; i < n; i++) {
    const az = (i / n) * 360; // 0=N, 90=E — same as Horizons / LOLA mask
    const elevDeg = Number(elevs[i]);
    const elev = Number.isFinite(elevDeg) ? elevDeg : 0;
    const ridgeH = demH + RING_RANGE_M * Math.tan((elev * Math.PI) / 180) * MESH_EXAG;
    const safeH = Number.isFinite(ridgeH) ? ridgeH : demH;
    pushEnuPoint(Cesium, ellipsoid, input.lon, input.lat, demH, az, RING_RANGE_M, safeH, top);
    pushEnuPoint(
      Cesium,
      ellipsoid,
      input.lon,
      input.lat,
      demH,
      az,
      INNER_RANGE_M,
      demH + 2,
      inner
    );
  }

  // Close the ring
  top.push(top[0]!, top[1]!, top[2]!);
  inner.push(inner[0]!, inner[1]!, inner[2]!);

  const positions: number[] = [];
  const indices: number[] = [];
  const m = n + 1;
  for (let i = 0; i < m; i++) {
    const i3 = i * 3;
    positions.push(inner[i3]!, inner[i3 + 1]!, inner[i3 + 2]!);
  }
  for (let i = 0; i < m; i++) {
    const i3 = i * 3;
    positions.push(top[i3]!, top[i3 + 1]!, top[i3 + 2]!);
  }
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = i + 1;
    const c = i + m;
    const d = i + 1 + m;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: new Float64Array(positions),
      }),
    },
    indices: new Uint32Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
  });

  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString("#6e6a64").withAlpha(0.98)
        ),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: false,
      closed: false,
    }),
    asynchronous: false,
  });
}

function pushEnuPoint(
  Cesium: any,
  ellipsoid: any,
  lon: number,
  lat: number,
  baseH: number,
  azDeg: number,
  rangeM: number,
  heightM: number,
  out: number[]
) {
  const origin = Cesium.Cartesian3.fromDegrees(lon, lat, baseH, ellipsoid);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);
  const az = Cesium.Math.toRadians(azDeg);
  const local = new Cesium.Cartesian3(Math.sin(az) * rangeM, Math.cos(az) * rangeM, 0);
  const world = Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
  const c = Cesium.Cartographic.fromCartesian(world, ellipsoid);
  const p = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightM, ellipsoid);
  out.push(p.x, p.y, p.z);
}
