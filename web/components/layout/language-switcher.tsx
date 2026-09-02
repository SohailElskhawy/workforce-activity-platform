"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, isPending } = useI18n();

  const toggleLanguage = () => {
    const nextLocale: Locale = locale === "tr" ? "en" : "tr";
    setLocale(nextLocale);
  };

  return (
    <button
      aria-label={locale === "tr" ? "Dili İngilizce yap" : "Switch language to Turkish"}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition-all hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
      disabled={isPending}
      onClick={toggleLanguage}
      type="button"
    >
      <Globe className="size-3.5 text-slate-500" />
      <span className="font-semibold uppercase">{locale}</span>
      <span className="text-[11px] text-slate-400">
        {locale === "tr" ? "🇹🇷" : "🇬🇧"}
      </span>
    </button>
  );
}
