"use client";

import type { DailyTimelineDay } from "@/lib/api";

const SUN_COLOR = "#e8b830";
const EARTH_COLOR = "#4a9eff";

function chartYMax(days: DailyTimelineDay[]) {
  let m = 24;
  for (const d of days) {
    m = Math.max(m, d.sun_hours, d.earth_hours);
  }
  return Math.ceil(m);
}

function polylinePoints(
  days: DailyTimelineDay[],
  key: "sun_hours" | "earth_hours",
  w: number,
  h: number,
  yMax: number
) {
  const padL = 40;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = days.length;
  if (n === 0) return "";
  const step = n > 1 ? innerW / (n - 1) : 0;
  return days
    .map((d, i) => {
      const x = padL + (n > 1 ? i * step : innerW / 2);
      const y = padT + innerH - (d[key] / yMax) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function shortUtcDay(day: string) {
  try {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return day;
  }
}

export default function ReportDailyTimeline({
  optionLabel,
  siteName,
  days,
  legendSun,
  legendEarth,
  axisHours,
  empty,
}: {
  optionLabel: string;
  siteName: string;
  days: DailyTimelineDay[];
  legendSun: string;
  legendEarth: string;
  axisHours: string;
  empty?: string;
}) {
  const w = 640;
  const h = 168;
  const yMax = chartYMax(days);
  const padL = 40;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = days.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const labelEvery = n > 16 ? Math.ceil(n / 10) : 1;

  if (!days.length) {
    return (
      <article className="mani-sheet__timeline">
        <h3 className="mani-sheet__timeline-title">
          {optionLabel} · {siteName}
        </h3>
        <p className="mani-sheet__timeline-empty">{empty ?? "—"}</p>
      </article>
    );
  }

  const gridYs = [0, yMax / 2, yMax];

  return (
    <article className="mani-sheet__timeline">
      <h3 className="mani-sheet__timeline-title">
        {optionLabel} · {siteName}
      </h3>
      <ul className="mani-sheet__timeline-legend" aria-hidden>
        <li>
          <span className="mani-sheet__timeline-swatch mani-sheet__timeline-swatch--sun" />
          {legendSun}
        </li>
        <li>
          <span className="mani-sheet__timeline-swatch mani-sheet__timeline-swatch--earth" />
          {legendEarth}
        </li>
      </ul>
      <svg
        className="mani-sheet__timeline-chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${optionLabel} ${siteName}`}
      >
        {gridYs.map((gv) => {
          const y = padT + innerH - (gv / yMax) * innerH;
          return (
            <g key={gv}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                className="mani-sheet__timeline-grid"
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="mani-sheet__timeline-tick">
                {gv === 0 ? "0" : `${Math.round(gv)}`}
              </text>
            </g>
          );
        })}
        <text x={4} y={padT + innerH / 2} className="mani-sheet__timeline-ylab">
          {axisHours}
        </text>
        <polyline
          fill="none"
          stroke={SUN_COLOR}
          strokeWidth={2.25}
          strokeLinejoin="round"
          points={polylinePoints(days, "sun_hours", w, h, yMax)}
        />
        <polyline
          fill="none"
          stroke={EARTH_COLOR}
          strokeWidth={2.25}
          strokeLinejoin="round"
          points={polylinePoints(days, "earth_hours", w, h, yMax)}
        />
        {days.map((d, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return null;
          const x = padL + (n > 1 ? i * step : innerW / 2);
          return (
            <text
              key={d.day}
              x={x}
              y={h - 6}
              textAnchor="middle"
              className="mani-sheet__timeline-xlab"
            >
              {shortUtcDay(d.day)}
            </text>
          );
        })}
        {days.map((d, i) => {
          const x = padL + (n > 1 ? i * step : innerW / 2);
          const ySun = padT + innerH - (d.sun_hours / yMax) * innerH;
          const yEarth = padT + innerH - (d.earth_hours / yMax) * innerH;
          return (
            <g key={`${d.day}-dots`}>
              <circle cx={x} cy={ySun} r={2.5} fill={SUN_COLOR} />
              <circle cx={x} cy={yEarth} r={2.5} fill={EARTH_COLOR} />
            </g>
          );
        })}
      </svg>
    </article>
  );
}