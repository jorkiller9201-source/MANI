"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authApi.login(email.trim(), password);
      router.push("/app");
    } catch (err: any) {
      setError(err.message || t("loginFailed"));
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
      <h1 className="text-3xl font-semibold text-white">{t("loginTitle")}</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
          {t("password")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="text-[#f2d27a]/90 hover:underline">
            {t("forgotPasswordLink")}
          </Link>
        </p>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-60"
          type="submit"
        >
          {busy ? t("signingIn") : t("signIn")}
        </button>
      </form>
      <p className="mt-4 text-sm text-white/55">
        {t("newHere")} <Link href="/register">{t("createAccount")}</Link>
      </p>
    </main>
  );
}
