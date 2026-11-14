type GlossDict = Record<string, string>;

/** English glossary strings merged into the main dictionary. */
export const GLOSSARY_EN: GlossDict = {
  aboutTabOverview: "Overview",
  aboutTabGlossary: "Glossary",
  aboutGlossaryLead:
    "Short definitions for labels and concepts in MANI. Ordered by topic so you can follow the app from map to report without prior lunar-mission jargon.",

  glossaryCatMission: "Mission and app",
  glossaryCatSites: "Sites A and B",
  glossaryCatMap: "Map and globe",
  glossaryCatTime: "Dates and time",
  glossaryCatSky: "Sun, Earth, and horizon",
  glossaryCatMetrics: "Comparison and score",
  glossaryCatData: "NASA data sources",
  glossaryCatReport: "Report and account",

  glossaryTerm_mission_mani: "MANI",
  glossaryDef_mission_mani:
    "Moon Analysis & Navigation Intelligent — name of this web app. It compares two lunar south-pole locations across a UTC date range using NASA ephemeris and terrain data.",

  glossaryTerm_mission_clps: "CLPS",
  glossaryDef_mission_clps:
    "Commercial Lunar Payload Services — NASA program that hires commercial landers to deliver science and technology to the Moon. MANI supports planning where and when those landings might work best.",

  glossaryTerm_mission_artemis: "Artemis",
  glossaryDef_mission_artemis:
    "NASA’s program to return humans to the Moon. South-pole landing sites need reliable sunlight and Earth in view — the same questions MANI summarizes.",

  glossaryTerm_mission_landing: "Lunar landing / alunizaje",
  glossaryDef_mission_landing:
    "Touching down safely on the Moon. Here we compare candidate sites and time windows, not full trajectory or hazard maps.",

  glossaryTerm_mission_space_apps: "Space Apps / Nova 3",
  glossaryDef_mission_space_apps:
    "NASA International Space Apps Challenge; Nova 3 is our Tegucigalpa team (Chiminike, Fundación Próspera) that built MANI for the 2026 challenge.",

  glossaryTerm_sites_a_b: "Site A / Site B",
  glossaryDef_sites_a_b:
    "The two options you compare side by side. Pick them from the dropdown lists, map markers, or two clicks on the globe (first click = A, second = B).",

  glossaryTerm_sites_curated: "Curated site",
  glossaryDef_sites_curated:
    "A pre-defined CLPS south-pole candidate from MANI’s catalog, with cached Horizons and LOLA horizon data for faster, offline-friendly comparison.",

  glossaryTerm_sites_custom: "Custom map point",
  glossaryDef_sites_custom:
    "Any lat/lon you choose with two map clicks (within LOLA coverage). Requires network so MANI can fetch live Horizons and build a LOLA mask on the fly.",

  glossaryTerm_site_shackleton: "Shackleton Rim",
  glossaryDef_site_shackleton:
    "Rim of Shackleton crater near the south pole — often studied for patches of near-continuous sunlight on the rim.",

  glossaryTerm_site_malapert: "Malapert Massif",
  glossaryDef_site_malapert:
    "A raised massif near the pole, frequently cited for Earth visibility from elevated terrain.",

  glossaryTerm_site_de_gerlache: "de Gerlache Rim",
  glossaryDef_site_de_gerlache:
    "Rim region associated with de Gerlache crater, another south-pole illumination candidate.",

  glossaryTerm_site_connecting_ridge: "Connecting Ridge",
  glossaryDef_site_connecting_ridge:
    "A ridge between Shackleton and de Gerlache areas — a narrow landing-relevant topographic link in the catalog.",

  glossaryTerm_site_nobile: "Nobile Rim",
  glossaryDef_site_nobile:
    "Rim area near Nobile crater, included as a CLPS-relevant south-pole region.",

  glossaryTerm_site_haworth: "Haworth",
  glossaryDef_site_haworth:
    "Crater region at the south pole listed among candidate sites in the MANI catalog.",

  glossaryTerm_map_pole: "Lunar south pole",
  glossaryDef_map_pole:
    "The southern end of the Moon’s rotation axis. MANI focuses here because CLPS and Artemis studies concentrate on this region.",

  glossaryTerm_map_coords: "Lat / lon (selenographic)",
  glossaryDef_map_coords:
    "Latitude and longitude on the Moon (selenographic coordinates), shown in degrees. They define the observer position for Horizons and appear in results and reports.",

  glossaryTerm_map_moon_trek: "Moon Trek",
  glossaryDef_map_moon_trek:
    "NASA’s online Moon atlas. MANI uses its imagery (LRO wide-area camera) as the base map and context for landing sites.",

  glossaryTerm_map_cesium: "Cesium / 3D globe",
  glossaryDef_map_cesium:
    "CesiumJS — software that renders the interactive 3D Moon you can drag, zoom, and click to pick points.",

  glossaryTerm_map_lola_relief: "LOLA relief",
  glossaryDef_map_lola_relief:
    "Shaded terrain from the Lunar Orbiter Laser Altimeter (LOLA) overlaid on the globe to show hills and craters.",

  glossaryTerm_map_layers: "Map toggles (names, craters, relief, Sun & Earth)",
  glossaryDef_map_layers:
    "Checkboxes on the map: crater nomenclature, LOLA relief shading, and optional sky markers for Sun and Earth at a chosen UTC time.",

  glossaryTerm_time_utc: "UTC",
  glossaryDef_time_utc:
    "Coordinated Universal Time — a single worldwide time standard. All windows, timelines, and Horizons queries in MANI use UTC so results are unambiguous.",

  glossaryTerm_time_window: "Analysis window (Start / End UTC)",
  glossaryDef_time_window:
    "The From–To date range you choose before Compare. MANI counts Sun and Earth hours only inside this interval.",

  glossaryTerm_time_ephemeris: "Ephemeris (Horizons)",
  glossaryDef_time_ephemeris:
    "A table of where the Sun and Earth are in the sky over time. MANI takes these angles from the JPL Horizons system for each site.",

  glossaryTerm_time_sky_epoch: "Sky time (UTC)",
  glossaryDef_time_sky_epoch:
    "Clock time used only for the map’s Sun/Earth direction display — you can sync it to the compare start with Use compare start.",

  glossaryTerm_sky_sun: "Sun",
  glossaryDef_sky_sun:
    "Our star. On the Moon, hours with the Sun above the horizon matter for solar panels and thermal balance.",

  glossaryTerm_sky_earth: "Earth",
  glossaryDef_sky_earth:
    "Home planet as seen from the landing site. When Earth is above the horizon, direct radio link to mission control is possible without a relay satellite.",

  glossaryTerm_sky_horizon_geom: "Geometric horizon",
  glossaryDef_sky_horizon_geom:
    "A flat, smooth horizon at the observer — as if the Moon had no mountains. Horizons gives Sun/Earth elevation relative to this ideal horizon (geometric hours).",

  glossaryTerm_sky_horizon_topo: "Topographic horizon / LOLA horizon",
  glossaryDef_sky_horizon_topo:
    "The real skyline formed by nearby terrain (crater rims, peaks). A body counts as visible only if it clears this uneven horizon (topo hours).",

  glossaryTerm_sky_azimuth: "Azimuth",
  glossaryDef_sky_azimuth:
    "Compass direction around the horizon (0°–360°), used with elevation to describe where the Sun or Earth appears in the sky.",

  glossaryTerm_sky_elevation: "Elevation (height angle)",
  glossaryDef_sky_elevation:
    "How high the Sun or Earth is above the horizon in degrees. Positive = above the horizon; negative = below.",

  glossaryTerm_sky_clearing: "Topographic clearing",
  glossaryDef_sky_clearing:
    "Check whether Horizons elevation beats the LOLA horizon height in that direction (including slight lunar curvature). Used for topo hour counts and score.",

  glossaryTerm_sky_mask: "Horizon mask",
  glossaryDef_sky_mask:
    "A 360° profile of maximum terrain height around the site, precomputed from LOLA for catalog sites or calculated for custom points.",

  glossaryTerm_metrics_compare: "Compare sites",
  glossaryDef_metrics_compare:
    "Runs the calculation for Site A and Site B over your UTC window and shows side-by-side numbers plus a recommendation.",

  glossaryTerm_metrics_score: "Score (topo)",
  glossaryDef_metrics_score:
    "A 0–100 summary favoring topo-clear Sun hours, topo-clear Earth hours, and average Sun elevation (Nova 3 heuristic — not an official NASA metric).",

  glossaryTerm_metrics_geom_hours: "Sun / Earth hours (geometric)",
  glossaryDef_metrics_geom_hours:
    "How many hours in the window the Sun or Earth stays above the flat geometric horizon, from Horizons alone.",

  glossaryTerm_metrics_topo_hours: "Sun / Earth hours (LOLA topo)",
  glossaryDef_metrics_topo_hours:
    "Same counting, but each time step must also clear the LOLA topographic horizon — usually fewer hours than the geometric case.",

  glossaryTerm_metrics_recommendation: "Recommendation",
  glossaryDef_metrics_recommendation:
    "Which site wins for the chosen window based on combined topo Sun + Earth visibility (the higher topo score).",

  glossaryTerm_metrics_mean_elev: "Mean Sun / Earth elevation",
  glossaryDef_metrics_mean_elev:
    "Average height angle of the Sun or Earth while it is above the geometric horizon in the window — a rough “how high in the sky” indicator.",

  glossaryTerm_metrics_until_set: "Hours until topo sunset / Earthset",
  glossaryDef_metrics_until_set:
    "From the start of your window, how long until the Sun or Earth drops below the topographic horizon (if it was visible at start).",

  glossaryTerm_data_horizons: "JPL Horizons",
  glossaryDef_data_horizons:
    "NASA/JPL Solar System Dynamics service that computes precise positions of Sun, Earth, and spacecraft. MANI queries it as an observer standing on the Moon.",

  glossaryTerm_data_lola: "LOLA",
  glossaryDef_data_lola:
    "Lunar Orbiter Laser Altimeter on LRO — measured lunar surface heights used to build terrain and horizon masks.",

  glossaryTerm_data_ldem: "LDEM_75S_240M",
  glossaryDef_data_ldem:
    "LOLA digital elevation model of the south polar region (~75°S–90°S). MANI’s topo masks and custom-point coverage refer to this product.",

  glossaryTerm_data_lro: "LRO / WAC",
  glossaryDef_data_lro:
    "Lunar Reconnaissance Orbiter and its Wide Angle Camera — source of the global basemap imagery via Moon Trek.",

  glossaryTerm_data_pds: "PDS",
  glossaryDef_data_pds:
    "NASA Planetary Data System — archive where LOLA elevation products are published and cited.",

  glossaryTerm_data_offline: "Offline / cached data",
  glossaryDef_data_offline:
    "Catalog sites ship with pre-downloaded Horizons JSON and LOLA masks so the demo can compare without live internet; custom points need the network.",

  glossaryTerm_report_one_page: "One-page report",
  glossaryDef_report_one_page:
    "Text summary of the comparison you can copy — window, both sites, hours, scores, and data sources.",

  glossaryTerm_report_annex_a: "Annex A",
  glossaryDef_report_annex_a:
    "Map snapshot for export: the Moon Trek globe with points A and B marked, attached when you save or print a mission report.",

  glossaryTerm_report_timeline: "Daily timelines",
  glossaryDef_report_timeline:
    "Charts of hours per calendar day in the window: yellow = Sun topo clear, blue = Earth topo clear (1-hour Horizons steps).",

  glossaryTerm_report_export: "Export report / PDF",
  glossaryDef_report_export:
    "Saves the formatted mission report (logo, window, annex, timelines) to your account history and opens the browser print dialog for PDF.",

  glossaryTerm_report_history: "My reports / history",
  glossaryDef_report_history:
    "List of past exports stored with your login so you can reopen and reprint them.",

  glossaryTerm_team_si: "Super Intelligence (SI)",
  glossaryDef_team_si:
    "In Space Apps 2026 we say SI, not “AI”. Cursor assisted code and docs; mission logic and NASA number checks are the human team’s work (see About → SI).",
};

/** Spanish glossary strings (override English where provided). */
export const GLOSSARY_ES: GlossDict = {
  aboutTabOverview: "Información",
  aboutTabGlossary: "Diccionario de términos",
  aboutGlossaryLead:
    "Definiciones breves de las etiquetas y conceptos de MANI. Agrupadas por tema para seguir la app del mapa al informe sin conocer antes la jerga de misiones lunares.",

  glossaryCatMission: "Misión y aplicación",
  glossaryCatSites: "Sitios A y B",
  glossaryCatMap: "Mapa y globo",
  glossaryCatTime: "Fechas y hora",
  glossaryCatSky: "Sol, Tierra y horizonte",
  glossaryCatMetrics: "Comparación y puntuación",
  glossaryCatData: "Fuentes de datos NASA",
  glossaryCatReport: "Informe y cuenta",

  glossaryTerm_mission_mani: "MANI",
  glossaryDef_mission_mani:
    "Moon Analysis & Navigation Intelligent (siglas en inglés del nombre MANI). Aplicación web que compara dos ubicaciones del polo sur lunar en un rango de fechas UTC usando efemérides y terreno de la NASA.",

  glossaryTerm_mission_clps: "CLPS",
  glossaryDef_mission_clps:
    "Commercial Lunar Payload Services — programa de la NASA que contrata alunizadores comerciales para llevar ciencia y tecnología a la Luna. MANI ayuda a planificar dónde y cuándo conviene.",

  glossaryTerm_mission_artemis: "Artemis",
  glossaryDef_mission_artemis:
    "Programa de la NASA para volver a llevar humanos a la Luna. Los sitios del polo sur necesitan luz solar y Tierra a la vista; MANI resume esas preguntas.",

  glossaryTerm_mission_landing: "Alunizaje",
  glossaryDef_mission_landing:
    "Aterrizar con seguridad en la Luna. Aquí comparamos sitios y ventanas de tiempo, no la trayectoria completa ni mapas de peligros.",

  glossaryTerm_mission_space_apps: "Space Apps / Nova 3",
  glossaryDef_mission_space_apps:
    "NASA International Space Apps Challenge; Nova 3 es nuestro equipo de Tegucigalpa (Chiminike, Fundación Próspera) que construyó MANI en 2026.",

  glossaryTerm_sites_a_b: "Sitio A / Sitio B",
  glossaryDef_sites_a_b:
    "Las dos opciones que comparas en paralelo. Elígelas en las listas, en marcadores del mapa o con dos clics en el globo (primero A, luego B).",

  glossaryTerm_sites_curated: "Sitio curado",
  glossaryDef_sites_curated:
    "Candidato CLPS del catálogo de MANI, con Horizons y máscara LOLA precargados para comparar más rápido y con menos dependencia de red.",

  glossaryTerm_sites_custom: "Punto del mapa",
  glossaryDef_sites_custom:
    "Cualquier lat/lon que elijas con dos clics (dentro de la cobertura LOLA). Requiere red para Horizons en vivo y máscara LOLA al vuelo.",

  glossaryTerm_site_shackleton: "Shackleton Rim",
  glossaryDef_site_shackleton:
    "Borde del cráter Shackleton, cerca del polo sur — estudiado por zonas con luz solar casi continua en el aro.",

  glossaryTerm_site_malapert: "Malapert Massif",
  glossaryDef_site_malapert:
    "Macizo elevado cerca del polo, citado a menudo por la visibilidad de la Tierra desde terreno alto.",

  glossaryTerm_site_de_gerlache: "de Gerlache Rim",
  glossaryDef_site_de_gerlache:
    "Región del borde asociada al cráter de Gerlache, otro candidato de iluminación polar.",

  glossaryTerm_site_connecting_ridge: "Connecting Ridge",
  glossaryDef_site_connecting_ridge:
    "Cresta entre las zonas de Shackleton y de Gerlache — enlace topográfico estrecho del catálogo.",

  glossaryTerm_site_nobile: "Nobile Rim",
  glossaryDef_site_nobile:
    "Zona del borde cerca del cráter Nobile, incluida como región CLPS del polo sur.",

  glossaryTerm_site_haworth: "Haworth",
  glossaryDef_site_haworth:
    "Región del cráter Haworth en el polo sur, entre los sitios del catálogo de MANI.",

  glossaryTerm_map_pole: "Polo sur lunar",
  glossaryDef_map_pole:
    "Extremo sur del eje de rotación de la Luna. MANI se centra aquí porque CLPS y Artemis estudian sobre todo esta región.",

  glossaryTerm_map_coords: "Lat / lon (selenográficas)",
  glossaryDef_map_coords:
    "Latitud y longitud en la Luna, en grados. Definen el observador de Horizons y aparecen en resultados e informes.",

  glossaryTerm_map_moon_trek: "Moon Trek",
  glossaryDef_map_moon_trek:
    "Atlas lunar en línea de la NASA. MANI usa su imagen (cámara de área amplia LRO) como mapa base.",

  glossaryTerm_map_cesium: "Cesium / globo 3D",
  glossaryDef_map_cesium:
    "CesiumJS — programa que dibuja el globo lunar 3D que puedes girar, acercar y clicar para elegir puntos.",

  glossaryTerm_map_lola_relief: "Relieve LOLA",
  glossaryDef_map_lola_relief:
    "Terreno sombreado del altímetro LOLA superpuesto al globo para ver colinas y cráteres.",

  glossaryTerm_map_layers: "Capas del mapa (nombres, cráteres, relieve, Sol y Tierra)",
  glossaryDef_map_layers:
    "Casillas del mapa: nombres de cráteres, relieve LOLA y marcadores opcionales de Sol y Tierra a una hora UTC.",

  glossaryTerm_time_utc: "UTC",
  glossaryDef_time_utc:
    "Tiempo Universal Coordinado — estándar horario mundial. Ventanas, líneas de tiempo y consultas Horizons usan UTC.",

  glossaryTerm_time_window: "Ventana de análisis (Inicio / Fin UTC)",
  glossaryDef_time_window:
    "Rango Desde–Hasta que eliges antes de Comparar. MANI cuenta horas de Sol y Tierra solo dentro de ese intervalo.",

  glossaryTerm_time_ephemeris: "Efemérides (Horizons)",
  glossaryDef_time_ephemeris:
    "Tabla de dónde están Sol y Tierra en el cielo en cada instante. MANI toma esos ángulos del sistema JPL Horizons para cada sitio.",

  glossaryTerm_time_sky_epoch: "Hora del cielo (UTC)",
  glossaryDef_time_sky_epoch:
    "Hora solo para la dirección de Sol/Tierra en el mapa; puedes igualarla al inicio de la comparación con Usar inicio de comparación.",

  glossaryTerm_sky_sun: "Sol",
  glossaryDef_sky_sun:
    "Nuestra estrella. En la Luna, las horas con el Sol sobre el horizonte importan para paneles solares y temperatura.",

  glossaryTerm_sky_earth: "Tierra",
  glossaryDef_sky_earth:
    "Planeta visto desde el sitio. Con la Tierra sobre el horizonte hay enlace de radio directo con control de misión, sin satélite relevo.",

  glossaryTerm_sky_horizon_geom: "Horizonte geométrico",
  glossaryDef_sky_horizon_geom:
    "Horizonte liso y plano en el observador — como si la Luna no tuviera montañas. Horizons da la elevación respecto a este horizonte ideal (horas geométricas).",

  glossaryTerm_sky_horizon_topo: "Horizonte topográfico / LOLA",
  glossaryDef_sky_horizon_topo:
    "Línea real del terreno cercano (bordes de cráter, picos). Un cuerpo cuenta como visible solo si supera ese perfil (horas topo).",

  glossaryTerm_sky_azimuth: "Azimut",
  glossaryDef_sky_azimuth:
    "Dirección en el horizonte (0°–360°), junto con la elevación, para ubicar Sol o Tierra en el cielo.",

  glossaryTerm_sky_elevation: "Elevación (ángulo de altura)",
  glossaryDef_sky_elevation:
    "Qué tan alto está Sol o Tierra sobre el horizonte, en grados. Positivo = sobre el horizonte; negativo = debajo.",

  glossaryTerm_sky_clearing: "Despeje topográfico",
  glossaryDef_sky_clearing:
    "Comprueba si la elevación de Horizons supera la altura del horizonte LOLA en esa dirección (con curvatura lunar). Base de las horas topo y la puntuación.",

  glossaryTerm_sky_mask: "Máscara de horizonte",
  glossaryDef_sky_mask:
    "Perfil 360° de la altura máxima del terreno alrededor del sitio, precalculado en el catálogo o generado para puntos personalizados.",

  glossaryTerm_metrics_compare: "Comparar sitios",
  glossaryDef_metrics_compare:
    "Ejecuta el cálculo para A y B en tu ventana UTC y muestra cifras lado a lado más una recomendación.",

  glossaryTerm_metrics_score: "Puntuación (topo)",
  glossaryDef_metrics_score:
    "Resumen 0–100 que pondera horas topo de Sol, horas topo de Tierra y elevación media del Sol (heurística Nova 3 — no es métrica oficial NASA).",

  glossaryTerm_metrics_geom_hours: "Horas de Sol / Tierra (geométricas)",
  glossaryDef_metrics_geom_hours:
    "Cuántas horas del intervalo Sol o Tierra permanecen sobre el horizonte geométrico plano, según Horizons.",

  glossaryTerm_metrics_topo_hours: "Horas de Sol / Tierra (topo LOLA)",
  glossaryDef_metrics_topo_hours:
    "Mismo conteo, pero cada paso debe superar el horizonte topográfico LOLA — suele dar menos horas que el caso geométrico.",

  glossaryTerm_metrics_recommendation: "Recomendación",
  glossaryDef_metrics_recommendation:
    "Qué sitio gana en la ventana elegida según la visibilidad topo combinada de Sol y Tierra (mayor puntuación topo).",

  glossaryTerm_metrics_mean_elev: "Elevación media del Sol / Tierra",
  glossaryDef_metrics_mean_elev:
    "Promedio del ángulo de altura mientras el cuerpo está sobre el horizonte geométrico — indicador de “qué tan alto en el cielo”.",

  glossaryTerm_metrics_until_set: "Horas hasta ocaso topo / ocultamiento topo",
  glossaryDef_metrics_until_set:
    "Desde el inicio de la ventana, cuánto falta para que Sol o Tierra queden bajo el horizonte topográfico (si empezaron visibles).",

  glossaryTerm_data_horizons: "JPL Horizons",
  glossaryDef_data_horizons:
    "Servicio SSD de la NASA/JPL con posiciones precisas de Sol, Tierra y naves. MANI lo consulta como observador en la superficie lunar.",

  glossaryTerm_data_lola: "LOLA",
  glossaryDef_data_lola:
    "Altímetro láser del LRO — midió alturas lunares para terreno y máscaras de horizonte.",

  glossaryTerm_data_ldem: "LDEM_75S_240M",
  glossaryDef_data_ldem:
    "Modelo digital de elevación LOLA del polo sur (~75°S–90°S). Cobertura y máscaras topo de MANI se basan en este producto.",

  glossaryTerm_data_lro: "LRO / WAC",
  glossaryDef_data_lro:
    "Lunar Reconnaissance Orbiter y su cámara de área amplia — imagen base global vía Moon Trek.",

  glossaryTerm_data_pds: "PDS",
  glossaryDef_data_pds:
    "Planetary Data System de la NASA — archivo donde se publican los productos de elevación LOLA.",

  glossaryTerm_data_offline: "Sin conexión / datos en caché",
  glossaryDef_data_offline:
    "Los sitios del catálogo traen Horizons y máscaras LOLA precargados; los puntos personalizados necesitan red.",

  glossaryTerm_report_one_page: "Informe de una página",
  glossaryDef_report_one_page:
    "Resumen en texto de la comparación para copiar: ventana, ambos sitios, horas, puntuaciones y fuentes.",

  glossaryTerm_report_annex_a: "Anexo A",
  glossaryDef_report_annex_a:
    "Captura del mapa para exportar: globo Moon Trek con A y B marcados, al guardar o imprimir el informe de misión.",

  glossaryTerm_report_timeline: "Líneas de tiempo diarias",
  glossaryDef_report_timeline:
    "Gráficas de horas por día natural en la ventana: amarillo = Sol con despeje topo; azul = Tierra con despeje topo (pasos Horizons de 1 h).",

  glossaryTerm_report_export: "Exportar informe / PDF",
  glossaryDef_report_export:
    "Guarda el informe formateado (logo, ventana, anexo, líneas de tiempo) en el historial de tu cuenta y abre impresión/PDF.",

  glossaryTerm_report_history: "Mis informes / historial",
  glossaryDef_report_history:
    "Lista de exportaciones guardadas con tu sesión para reabrirlas e imprimir de nuevo.",

  glossaryTerm_team_si: "Super Inteligencia (SI)",
  glossaryDef_team_si:
    "En Space Apps 2026 decimos SI, no «IA». Cursor apoyó código y documentación; la lógica de misión y la verificación de números NASA son del equipo humano (véase Acerca de → SI).",
};