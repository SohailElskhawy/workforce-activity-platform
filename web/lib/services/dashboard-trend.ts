import { APP_TIMEZONE } from "@/lib/time/timezone";

export type ActivityTrendRow = {
  startAt: Date;
  durationSeconds: number;
};

export type ActivityTrendPoint = {
  day: string;
  seconds: number;
};

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDay(day: string, offset: number) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date - offset));
  return value.toISOString().slice(0, 10);
}

export function buildActivityTrend(
  rows: ActivityTrendRow[],
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): ActivityTrendPoint[] {
  const days = Array.from({ length: 7 }, (_, index) =>
    previousDay(dayKey(now, timeZone), 6 - index),
  );
  const totals = new Map(days.map((day) => [day, 0]));

  for (const row of rows) {
    const day = dayKey(row.startAt, timeZone);
    if (totals.has(day)) {
      totals.set(day, (totals.get(day) ?? 0) + row.durationSeconds);
    }
  }

  return days.map((day) => ({ day, seconds: totals.get(day) ?? 0 }));
}
