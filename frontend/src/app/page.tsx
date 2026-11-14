"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    if (getToken()) router.replace("/app");
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-end gap-3">
        <LanguageSelector />
        <AboutButton />
      </div>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Image
          src="/mani-logo.png"
          alt="MANI — Moon Analysis & Navigation Intelligent · Nova 3"
          width={220}
          height={220}
          priority
          className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]"
        />
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[#f2d27a]">{t("homeTag")}</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-white">MANI</h1>
          <p className="mt-2 text-base text-white/55">{t("appTitle")}</p>
          <p className="mt-3 max-w-xl text-lg text-white/75">{t("homeLead")}</p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded bg-[#f2d27a] px-5 py-2.5 text-sm font-semibold text-[#0b1f3a]"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/register"
          className="rounded border border-white/25 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t("createAccount")}
        </Link>
      </div>
      <p className="mt-10 text-xs text-white/45">{t("homeFooter")}</p>
    </main>
  );
}
