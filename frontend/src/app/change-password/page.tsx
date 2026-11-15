"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (!me.must_change_password) router.replace("/app");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("changePasswordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const result = await authApi.changePassword(password);
      if (result.must_change_password) {
        setError(t("changePasswordFailed"));
        return;
      }
      // Confirm the flag cleared in DB before entering the app.
      const me = await authApi.me();
      if (me.must_change_password) {
        setError(t("changePasswordFailed"));
        return;
      }
      router.replace("/app");
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("different")) {
        setError(t("changePasswordSameAsTemp"));
      } else {
        setError(msg || t("changePasswordFailed"));
      }
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
      <h1 className="text-3xl font-semibold text-white">{t("changePasswordTitle")}</h1>
      <p className="mt-2 text-sm text-white/60">{t("changePasswordLead")}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm text-white/70">
          {t("changePasswordNew")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="block text-sm text-white/70">
          {t("changePasswordConfirm")}
          <input
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-white"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-60"
          type="submit"
        >
          {busy ? t("changePasswordSaving") : t("changePasswordSubmit")}
        </button>
      </form>
    </main>
  );
}
