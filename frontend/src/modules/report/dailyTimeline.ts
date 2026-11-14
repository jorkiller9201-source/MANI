import type { DailyTimelineDay } from "@/lib/api";
import type { EphemerisSample } from "@/modules/moon/skyBodies";

/** Fallback for saved reports before daily_timeline (geometric horizon only). */
export function geometricDailyTimeline(
  sun: EphemerisSample[] | undefined,
  earth: EphemerisSample[] | undefined
): DailyTimelineDay[] {
  if (!sun?.length) return [];
  const earthByTime = new Map(earth?.map((p) => [p.time, p]) ?? []);
  let dtH = 1;
  if (sun.length >= 2) {
    const ms = Date.parse(sun[1].time) - Date.parse(sun[0].time);
    if (ms > 0) dtH = ms / 3_600_000;
  }
  const buckets = new Map<string, { sun_hours: number; earth_hours: number }>();
  for (const sp of sun) {
    const day = sp.time.slice(0, 10);
    const b = buckets.get(day) ?? { sun_hours: 0, earth_hours: 0 };
    if (sp.elevation_deg > 0) b.sun_hours += dtH;
    const ep = earthByTime.get(sp.time);
    if (ep && ep.elevation_deg > 0) b.earth_hours += dtH;
    buckets.set(day, b);
  }
  return [...buckets.keys()]
    .sort()
    .map((day) => {
      const b = buckets.get(day)!;
      return {
        day,
        sun_hours: Math.round(b.sun_hours * 100) / 100,
        earth_hours: Math.round(b.earth_hours * 100) / 100,
      };
    });
}

export function resolveDailyTimeline(block: {
  daily_timeline?: DailyTimelineDay[];
  sun_series?: EphemerisSample[];
  earth_series?: EphemerisSample[];
}): DailyTimelineDay[] {
  if (block.daily_timeline?.length) return block.daily_timeline;
  return geometricDailyTimeline(block.sun_series, block.earth_series);
}