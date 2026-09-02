import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale, isLocale } from "./config";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";
import type { TranslationDictionary } from "./types";

const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  tr,
};

export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    if (isLocale(cookieValue)) {
      return cookieValue;
    }
  } catch {
    // In environments where cookies() cannot be read, fall back to default
  }
  return DEFAULT_LOCALE;
}

export async function getServerDictionary(specifiedLocale?: Locale): Promise<TranslationDictionary> {
  const locale = specifiedLocale ?? (await getServerLocale());
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function getDictionary(locale: Locale): TranslationDictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
