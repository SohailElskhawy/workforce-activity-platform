export const APP_TIMEZONE = "Europe/Istanbul";

export function getZonedDayBounds(
  dayInput?: string | Date | null,
  timeZone: string = APP_TIMEZONE,
): { dayStr: string; startAt: Date; endAt: Date } {
  let dayStr = "";
  if (typeof dayInput === "string") {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(dayInput.trim());
    if (match) {
      dayStr = match[0];
    }
  }
  if (!dayStr) {
    const d =
      dayInput instanceof Date && !Number.isNaN(dayInput.getTime())
        ? dayInput
        : new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayStr = formatter.format(d);
  }

  // Find the UTC offset for this day in target timezone
  const approxUtc = new Date(`${dayStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(approxUtc);

  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
  let offsetStr = "+03:00"; // Standard for Turkey
  if (tzPart) {
    const m = tzPart.match(/GMT([+-]\d{2}:\d{2})/);
    if (m) offsetStr = m[1];
  }

  const startAt = new Date(`${dayStr}T00:00:00${offsetStr}`);

  // Calculate next day string
  const [year, month, day] = dayStr.split("-").map(Number);
  const nextDayDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDayDate);

  const nextParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${nextDayStr}T12:00:00Z`));
  const nextTzPart = nextParts.find((p) => p.type === "timeZoneName")?.value;
  let nextOffsetStr = offsetStr;
  if (nextTzPart) {
    const m = nextTzPart.match(/GMT([+-]\d{2}:\d{2})/);
    if (m) nextOffsetStr = m[1];
  }

  const endAt = new Date(`${nextDayStr}T00:00:00${nextOffsetStr}`);

  return { dayStr, startAt, endAt };
}
