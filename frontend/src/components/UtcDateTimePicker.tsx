"use client";

import DatePicker, { registerLocale } from "react-datepicker";
import { enUS, es } from "date-fns/locale";
import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { isoUtcToPickerDate, pickerDateToIsoUtc } from "@/lib/utcIso";
import "react-datepicker/dist/react-datepicker.css";
import "./utc-datepicker.css";

registerLocale("en", enUS);
registerLocale("es", es);

const DATEPICKER_LOCALE: Record<string, string> = {
  en: "en",
  es: "es",
};

type Props = {
  id?: string;
  value: string;
  onChange: (isoUtc: string) => void;
  /** Minutes between time list entries (SKADI uses 1; compare window often uses 60). */
  timeIntervals?: number;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
};

export default function UtcDateTimePicker({
  id,
  value,
  onChange,
  timeIntervals = 60,
  compact = false,
  className = "",
  disabled = false,
}: Props) {
  const { lang, t } = useI18n();
  const selected = useMemo(() => isoUtcToPickerDate(value), [value]);
  const locale = DATEPICKER_LOCALE[lang] ?? "en";

  const inputClass = compact
    ? "w-full cursor-pointer rounded border border-white/20 bg-black/60 px-2 py-1 text-[11px] text-white"
    : "mt-1 w-full cursor-pointer rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white";

  return (
    <DatePicker
      id={id}
      selected={selected}
      onChange={(date: Date | null) => {
        const iso = pickerDateToIsoUtc(date);
        if (iso) onChange(iso);
      }}
      showTimeSelect
      timeIntervals={timeIntervals}
      timeFormat="HH:mm"
      dateFormat="yyyy-MM-dd HH:mm"
      timeCaption={t("utcTimeCaption")}
      placeholderText={t("utcDatePlaceholder")}
      locale={locale}
      withPortal
      portalId="mani-datepicker-portal"
      popperPlacement="bottom-start"
      popperClassName="mani-utc-datepicker-popper"
      disabled={disabled}
      className={`${inputClass} ${className}`.trim()}
      title={value}
    />
  );
}