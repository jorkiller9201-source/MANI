import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MANI — Moon Analysis & Navigation Intelligent",
  description: "Nova 3 · NASA Space Apps 2026 · Compare south-pole landing sites with Horizons data",
  icons: {
    icon: [{ url: "/mani-logo.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
