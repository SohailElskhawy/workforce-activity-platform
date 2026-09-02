import type { Locale } from "./i18n/config";

export function formatDate(date: Date | null | undefined, locale: Locale = "en") {
  if (!date) return "—";

  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDurationFromSeconds(
  seconds: number | null | undefined,
  locale: Locale = "en",
) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (locale === "tr") {
    return `${hours} sa ${minutes} dk`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatDurationFromMinutes(
  minutes: number | null | undefined,
  locale: Locale = "en",
) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (locale === "tr") {
    return `${hours} sa ${remainingMinutes} dk`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

export function formatActivityDifference(
  differenceMinutes: number,
  locale: Locale = "en",
) {
  if (!Number.isFinite(differenceMinutes)) return "—";

  if (locale === "tr") {
    if (differenceMinutes === 0) return "Manuel ve aktivite süresi eşleşiyor";
    const amount = `${Math.abs(differenceMinutes)} dk`;
    return differenceMinutes > 0
      ? `Aktivite süresine göre ${amount} daha fazla manuel süre`
      : `Manuel süreye göre ${amount} daha fazla aktivite süresi`;
  }

  if (differenceMinutes === 0) return "Manual and activity time match";

  const amount = `${Math.abs(differenceMinutes)}m`;
  return differenceMinutes > 0
    ? `${amount} more manual time than activity time`
    : `${amount} more activity time than manual time`;
}

