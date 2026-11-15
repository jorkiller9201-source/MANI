"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GSI load failed")));
      if (window.google?.accounts?.id) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GSI load failed"));
    document.head.appendChild(script);
  });
}

type Props = {
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  onError?: (message: string) => void;
};

export default function GoogleSignInButton({ disabled, onBusy, onError }: Props) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const hiddenBtnRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);

  const onBusyRef = useRef(onBusy);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  onBusyRef.current = onBusy;
  onErrorRef.current = onError;
  tRef.current = t;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const handleCredential = async (response: { credential: string }) => {
      setLocalBusy(true);
      onBusyRef.current?.(true);
      onErrorRef.current?.("");
      try {
        await authApi.loginWithGoogle(response.credential);
        router.push("/app");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : tRef.current("googleLoginFailed");
        onErrorRef.current?.(message || tRef.current("googleLoginFailed"));
      } finally {
        setLocalBusy(false);
        onBusyRef.current?.(false);
      }
    };

    (async () => {
      try {
        await loadGsiScript();
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });
        const host = hiddenBtnRef.current;
        if (host) {
          host.innerHTML = "";
          window.google.accounts.id.renderButton(host, {
            theme: "outline",
            size: "large",
            text: "continue_with",
            width: 384,
            locale: lang === "es" ? "es" : "en",
          });
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) onErrorRef.current?.(tRef.current("googleLoginFailed"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, lang, router]);

  if (!clientId) {
    return null;
  }

  function onClick() {
    if (disabled || localBusy || !ready) return;
    const native = hiddenBtnRef.current?.querySelector<HTMLElement>("div[role=button]");
    if (native) {
      native.click();
      return;
    }
    window.google?.accounts?.id?.prompt();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || localBusy || !ready}
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded border border-white/25 bg-white/95 py-2.5 text-sm font-semibold text-[#1f1f1f] disabled:opacity-60"
      >
        <GoogleMark />
        {localBusy ? t("signingIn") : t("continueWithGoogle")}
      </button>
      {/* Official GIS button (off-screen) — click target for ID token credential. */}
      <div
        ref={hiddenBtnRef}
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden
      />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
