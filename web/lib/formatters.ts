export function formatDate(date: Date | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDurationFromSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatDurationFromMinutes(minutes: number | null | undefined) {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatActivityDifference(differenceMinutes: number) {
  if (differenceMinutes === 0) return "Manual and activity time match";

  const amount = `${Math.abs(differenceMinutes)}m`;
  return differenceMinutes > 0
    ? `${amount} more manual time than activity time`
    : `${amount} more activity time than manual time`;
}
