"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";
import { formatErrorMessage } from "./errors";
import type { TranslationDictionary } from "./types";

const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  tr,
};

interface I18nContextValue {
  locale: Locale;
  t: TranslationDictionary;
  setLocale: (nextLocale: Locale) => void;
  formatError: (error: unknown) => string;
  isPending: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocaleState(nextLocale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  const activeT = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];

  const value: I18nContextValue = {
    locale,
    t: activeT,
    setLocale,
    formatError: (error: unknown) => formatErrorMessage(error, activeT),
    isPending,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: "en",
      t: dictionaries.en,
      setLocale: () => {},
      formatError: (error: unknown) => formatErrorMessage(error, dictionaries.en),
      isPending: false,
    };
  }
  return context;
}


