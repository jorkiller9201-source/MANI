/**
 * IAU / USGS Gazetteer features near the lunar south pole (lat ≤ −75°).
 * Source: planetary nomenclature exports (diameter ≥ 15 km). Used for map labels only.
 */
export type NomenFeature = {
  name: string;
  lat: number;
  lon: number;
  diameter_km: number;
  kind: "crater" | "region";
};

export const SOUTH_POLE_NOMENCLATURE: NomenFeature[] = [
  { name: "Zeeman", lat: -75.0682, lon: -135.0613, diameter_km: 186.6, kind: "crater" },
  { name: "Drygalski", lat: -79.5738, lon: -87.177, diameter_km: 162.5, kind: "crater" },
  { name: "Ashbrook", lat: -81.1043, lon: -110.575, diameter_km: 157.7, kind: "crater" },
  { name: "Demonax", lat: -78.0864, lon: 59.3552, diameter_km: 121.9, kind: "crater" },
  { name: "Scott", lat: -82.3532, lon: 48.5154, diameter_km: 107.8, kind: "crater" },
  { name: "Amundsen", lat: -84.4398, lon: 83.0691, diameter_km: 103.4, kind: "crater" },
  { name: "Cabeus", lat: -85.3303, lon: -42.1327, diameter_km: 100.6, kind: "crater" },
  { name: "Schomberger", lat: -76.6392, lon: 24.6912, diameter_km: 85.8, kind: "crater" },
  { name: "Newton", lat: -76.5207, lon: -17.4414, diameter_km: 83.9, kind: "crater" },
  { name: "Nobile", lat: -85.2752, lon: 53.2725, diameter_km: 79.3, kind: "crater" },
  { name: "Ganswindt", lat: -79.4155, lon: 111.1673, diameter_km: 77.5, kind: "crater" },
  { name: "Hedervari", lat: -81.7719, lon: 85.6005, diameter_km: 74.1, kind: "crater" },
  { name: "Malapert", lat: -84.9998, lon: 11.4031, diameter_km: 72.4, kind: "crater" },
  { name: "Idelʹson", lat: -81.3478, lon: 112.6939, diameter_km: 59.8, kind: "crater" },
  { name: "Shoemaker", lat: -88.137, lon: 45.911, diameter_km: 51.8, kind: "crater" },
  { name: "Haworth", lat: -87.45, lon: -5.17, diameter_km: 51.4, kind: "crater" },
  { name: "Faustini", lat: -87.1832, lon: 84.3099, diameter_km: 42.5, kind: "crater" },
  { name: "Wiechert", lat: -84.0334, lon: 164.701, diameter_km: 40.8, kind: "crater" },
  { name: "Sverdrup", lat: -88.3209, lon: -153.3875, diameter_km: 32.8, kind: "crater" },
  { name: "de Gerlache", lat: -88.4849, lon: -88.3447, diameter_km: 32.7, kind: "crater" },
  { name: "Slater", lat: -88.0792, lon: 111.2881, diameter_km: 25.1, kind: "crater" },
  { name: "Shackleton", lat: -89.67, lon: 129.78, diameter_km: 20.9, kind: "crater" },
  { name: "Connecting Ridge", lat: -89.5, lon: -137.0, diameter_km: 0, kind: "region" },
  { name: "Malapert Massif", lat: -85.99, lon: -2.0, diameter_km: 0, kind: "region" },
];
