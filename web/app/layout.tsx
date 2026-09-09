import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastContainer, ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/context";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-worklens-sans",
});

export const metadata: Metadata = {
  title: "WorkLens",
  description: "Workforce activity tracking",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={locale}>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
