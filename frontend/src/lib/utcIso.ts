/** Parse UTC ISO (`…Z`) into a local Date whose fields mirror UTC (for react-datepicker). */
export function isoUtcToPickerDate(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const normalized = iso.trim().endsWith("Z") ? iso.trim() : `${iso.trim()}Z`;
  const d = new Date(normalized.replace(/Z$/, "+00:00"));
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}

/** Format picker Date (UTC fields in local getters) back to `YYYY-MM-DDTHH:mm:ssZ`. */
export function pickerDateToIsoUtc(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const mi = d.getMinutes();
  const s = d.getSeconds();
  return `${y}-${pad(mo)}-${pad(day)}T${pad(h)}:${pad(mi)}:${pad(s)}Z`;
}