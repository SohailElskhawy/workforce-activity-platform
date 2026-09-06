import type { Metadata } from "next";
import { ToastContainer, ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/context";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkLens",
  description: "Workforce activity tracking",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className="h-full antialiased">
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

