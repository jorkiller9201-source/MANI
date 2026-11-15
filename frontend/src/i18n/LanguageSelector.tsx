"use client";

import { LANGUAGES } from "./languages";
import { useI18n } from "./I18nProvider";

type Props = {
  /** Compact control for header next to Log out */
  compact?: boolean;
};

export default function LanguageSelector({ compact }: Props) {
  const { lang, setLang, t } = useI18n();
  const labelId = "mani-lang-label";

  return (
    <div className={`mani-lang text-sm text-white/70${compact ? " mani-lang--compact" : ""}`}>
      <span id={labelId} className="mani-lang__label">
        {t("language")}
      </span>
      <select
        aria-labelledby={labelId}
        className="mani-lang__select"
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
