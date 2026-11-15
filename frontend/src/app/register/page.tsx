"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authApi.register(email.trim(), password, fullName.trim() || undefined);
      router.push("/app");
    } catch (err: any) {
      setError(err.message || t("registerFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-4 flex items-center justify-end gap-3">
        <LanguageSelector />
        <AboutButton />
      </div>
      <Image
        src="/mani-logo.png"
        alt="MANI"
        width={96}
        height={96}
        className="mb-4 h-24 w-24"
        priority
      />
      <h1 className="text-3xl font-semibold text-white">{t("registerTitle")}</h1>
      <p className="mt-2 text-sm text-white/60">{t("registerLead")}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm text-white/70">
          {t("fullName")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="block text-sm text-white/70">
          {t("email")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm text-white/70">
          {t("passwordMin")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-60"
          type="submit"
        >
          {busy ? t("creating") : t("register")}
        </button>
      </form>
      <p className="mt-4 text-sm text-white/55">
        {t("alreadyAccount")} <Link href="/login">{t("signIn")}</Link>
      </p>
    </main>
  );
}
