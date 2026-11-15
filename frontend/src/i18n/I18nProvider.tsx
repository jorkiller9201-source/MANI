"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLangCode, LANG_STORAGE_KEY, LANGUAGES, type LangCode } from "./languages";
import { t as translate, TRANSLATIONS } from "./translations";

type I18nContextValue = {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLang(): LangCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && isLangCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  if (isLangCode(nav)) return nav;
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always start as "en" on server AND first client paint to avoid hydration mismatch.
  const [lang, setLangState] = useState<LangCode>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLangState(detectInitialLang());
    setReady(true);
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const dir = useMemo(
    () => LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr",
    [lang]
  );

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, dir, ready }),
    [lang, setLang, t, dir, ready]
  );

  void TRANSLATIONS[lang];

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
