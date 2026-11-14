"use client";

import Image from "next/image";
import type { CompareResult } from "@/lib/api";
import ReportDailyTimeline from "./ReportDailyTimeline";
import { resolveDailyTimeline } from "./dailyTimeline";

type Labels = {
  title: string;
  tagline: string;
  queriedAt: string;
  printedAt: string;
  windowFrom: string;
  windowTo: string;
  recommendation: string;
  location: string;
  elevLola: string;
  sunTopo: string;
  earthTopo: string;
  sunGeom: string;
  earthGeom: string;
  score: string;
  scoreGeom: string;
  sources: string;
  team: string;
  confidential: string;
  annexA: string;
  annexALead: string;
  annexAMissing: string;
  annexACaption: string;
  timelineSection: string;
  timelineLead: string;
  timelineOptionA: string;
  timelineOptionB: string;
  timelineLegendSun: string;
  timelineLegendEarth: string;
  timelineAxisHours: string;
  timelineEmpty: string;
};

function fmt(n: number | null | undefined, d = 3) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function SitePanel({
  letter,
  block,
  accent,
  labels,
}: {
  letter: string;
  block: CompareResult["a"];
  accent: string;
  labels: Labels;
}) {
  const elev =
    block.lola_horizon?.dem_height_km ??
    (block.lola_horizon?.dem_height_m != null ? block.lola_horizon.dem_height_m / 1000 : null);
  return (
    <article className="mani-sheet__site" style={{ ["--accent" as string]: accent }}>
      <div className="mani-sheet__site-badge">{letter}</div>
      <h3 className="mani-sheet__site-name">{block.site.name}</h3>
      <p className="mani-sheet__site-loc">
        {labels.location} {fmt(block.location?.lat ?? block.site.lat, 4)}° /{" "}
        {fmt(block.location?.lon ?? block.site.lon, 4)}°
        {elev != null && (
          <>
            {" "}
            · {labels.elevLola} {fmt(elev, 3)} km
          </>
        )}
      </p>
      <div className="mani-sheet__meters">
        <div>
          <span>{labels.sunTopo}</span>
          <strong>{block.sun.hours_above_topo_horizon ?? block.sun.hours_above_horizon} h</strong>
        </div>
        <div>
          <span>{labels.earthTopo}</span>
          <strong>{block.earth.hours_above_topo_horizon ?? block.earth.hours_above_horizon} h</strong>
        </div>
        <div>
          <span>{labels.sunGeom}</span>
          <strong>{block.sun.hours_above_horizon} h</strong>
        </div>
        <div>
          <span>{labels.earthGeom}</span>
          <strong>{block.earth.hours_above_horizon} h</strong>
        </div>
      </div>
      <div className="mani-sheet__score-row">
        <span>{labels.score}</span>
        <em>{block.score}</em>
        {block.score_geometric != null && (
          <small>
            {labels.scoreGeom} {block.score_geometric}
          </small>
        )}
      </div>
    </article>
  );
}

export default function ReportSheet({
  result,
  reportText,
  queriedAt,
  printedAt,
  labels,
  mapImage,
}: {
  result: CompareResult;
  reportText: string;
  queriedAt: string;
  printedAt: string;
  labels: Labels;
  mapImage?: string | null;
}) {
  const nameA = result.a.site.name;
  const nameB = result.b.site.name;
  const latA = result.a.location?.lat ?? result.a.site.lat;
  const lonA = result.a.location?.lon ?? result.a.site.lon;
  const latB = result.b.location?.lat ?? result.b.site.lat;
  const lonB = result.b.location?.lon ?? result.b.site.lon;
  const coordA = `${fmt(latA, 4)}°, ${fmt(lonA, 4)}°`;
  const coordB = `${fmt(latB, 4)}°, ${fmt(lonB, 4)}°`;
  const daysA = resolveDailyTimeline(result.a);
  const daysB = resolveDailyTimeline(result.b);
  return (
    <div className="mani-sheet" id="mani-print-root">
      <div className="mani-sheet__glow" aria-hidden />
      <header className="mani-sheet__head">
        <Image src="/mani-logo.png" alt="MANI" width={120} height={120} className="mani-sheet__logo" />
        <div className="mani-sheet__head-text">
          <p className="mani-sheet__eyebrow">Nova 3 · NASA Space Apps 2026</p>
          <h1 className="mani-sheet__title">{labels.title}</h1>
          <p className="mani-sheet__tagline">{labels.tagline}</p>
        </div>
      </header>

      <div className="mani-sheet__dates">
        <div>
          <span>{labels.queriedAt}</span>
          <strong>{queriedAt}</strong>
        </div>
        <div>
          <span>{labels.printedAt}</span>
          <strong>{printedAt}</strong>
        </div>
        <div>
          <span>{labels.windowFrom}</span>
          <strong>{result.window.start}</strong>
        </div>
        <div>
          <span>{labels.windowTo}</span>
          <strong>{result.window.end}</strong>
        </div>
      </div>

      <div className="mani-sheet__winner">
        <span>{labels.recommendation}</span>
        <strong>{result.winner_name}</strong>
      </div>

      <div className="mani-sheet__grid">
        <SitePanel letter="A" block={result.a} accent="#f2d27a" labels={labels} />
        <SitePanel letter="B" block={result.b} accent="#7ec8ff" labels={labels} />
      </div>

      <section className="mani-sheet__timelines" aria-label={labels.timelineSection}>
        <h2 className="mani-sheet__timelines-head">{labels.timelineSection}</h2>
        <p className="mani-sheet__timelines-lead">{labels.timelineLead}</p>
        <ReportDailyTimeline
          optionLabel={labels.timelineOptionA}
          siteName={nameA}
          days={daysA}
          legendSun={labels.timelineLegendSun}
          legendEarth={labels.timelineLegendEarth}
          axisHours={labels.timelineAxisHours}
          empty={labels.timelineEmpty}
        />
        <ReportDailyTimeline
          optionLabel={labels.timelineOptionB}
          siteName={nameB}
          days={daysB}
          legendSun={labels.timelineLegendSun}
          legendEarth={labels.timelineLegendEarth}
          axisHours={labels.timelineAxisHours}
          empty={labels.timelineEmpty}
        />
      </section>

      <section className="mani-sheet__narrative">
        <pre>{reportText}</pre>
      </section>

      <footer className="mani-sheet__foot">
        <p>
          {labels.sources} {result.sources.ephemeris}
          {result.sources.topographic_horizon ? ` · ${result.sources.topographic_horizon}` : ""} ·{" "}
          {result.sources.terrain_context}
        </p>
        <p>{labels.team}</p>
        <p className="mani-sheet__stamp">{labels.confidential}</p>
      </footer>

      <section className="mani-sheet__annex" aria-label={labels.annexA}>
        <h2 className="mani-sheet__annex-title">{labels.annexA}</h2>
        <p className="mani-sheet__annex-lead">{labels.annexALead}</p>
        {mapImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="mani-sheet__map"
            src={mapImage}
            alt={labels.annexACaption.replace("{a}", nameA).replace("{b}", nameB)}
          />
        ) : (
          <p className="mani-sheet__annex-missing">{labels.annexAMissing}</p>
        )}
        <p className="mani-sheet__annex-caption">
          {labels.annexACaption
            .replace("{a}", nameA)
            .replace("{b}", nameB)
            .replace("{coordA}", coordA)
            .replace("{coordB}", coordB)}
        </p>
        <ul className="mani-sheet__annex-coords">
          <li>
            <strong>A · {nameA}</strong>
            <span>{coordA}</span>
          </li>
          <li>
            <strong>B · {nameB}</strong>
            <span>{coordB}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
