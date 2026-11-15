"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import LanguageSelector from "@/i18n/LanguageSelector";
import AboutButton from "@/i18n/AboutButton";

function mapForgotError(code: string, t: (key: string) => string): string {
  switch (code) {
    case "USER_NOT_REGISTERED":
      return t("forgotUserNotRegistered");
    case "SMTP_NOT_CONFIGURED":
      return t("forgotSmtpNotConfigured");
    case "EMAIL_SEND_FAILED":
      return t("forgotEmailFailed");
    default:
      return t("forgotPasswordFailed");
  }
}

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await authApi.forgotPassword(email.trim());
      setSuccess(data.dev_logged ? t("forgotPasswordDevLogged") : t("forgotPasswordSuccess"));
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "FORGOT_PASSWORD_FAILED";
      setError(mapForgotError(code, t));
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
      <h1 className="text-3xl font-semibold text-white">{t("forgotPasswordTitle")}</h1>
      <p className="mt-2 text-sm text-white/60">{t("forgotPasswordLead")}</p>
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
        {error && <p className="text-sm text-red-300">{error}</p>}
        {success && <p className="text-sm text-emerald-300">{success}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-[#f2d27a] py-2.5 text-sm font-semibold text-[#0b1f3a] disabled:opacity-60"
          type="submit"
        >
          {busy ? t("forgotPasswordSending") : t("forgotPasswordSubmit")}
        </button>
      </form>
      <p className="mt-4 text-sm text-white/55">
        <Link href="/login">{t("backToLogin")}</Link>
      </p>
    </main>
  );
}