"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { formatDurationFromSeconds } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { toTimelineLabel } from "@/lib/services/activity-presentation";

type TimelineActivity = {
  id: string;
  startAt: Date;
  durationSeconds: number;
  type: string;
  applicationName: string | null;
  processName: string | null;
  windowTitle: string | null;
  fileName: string | null;
  project: { id: string; name: string; code: string } | null;
  task: { id: string; title: string } | null;
};

type ActivityTimelineProps = { activities: TimelineActivity[] };

function formatTime(date: Date, locale: Locale) {
  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const { locale, t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.activities.title}</CardTitle>
        <CardDescription>
          {t.activities.subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                className="flex gap-4 border-b pb-4 last:border-0 last:pb-0"
                key={activity.id}
              >
                <time className="w-14 shrink-0 text-sm text-muted-foreground">
                  {formatTime(activity.startAt, locale)}
                </time>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {toTimelineLabel(activity)}
                    </span>
                    <Badge
                      variant={
                        activity.type === "IDLE" ? "secondary" : "outline"
                      }
                    >
                      {formatDurationFromSeconds(activity.durationSeconds, locale)}
                    </Badge>
                    {activity.fileName && !activity.project ? (
                      <Badge variant="outline">{t.managerDashboard.unmappedActivity}</Badge>
                    ) : null}
                  </div>
                  {activity.fileName || activity.windowTitle ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {activity.fileName ?? activity.windowTitle}
                    </p>
                  ) : null}
                  {activity.project ? (
                    <p className="text-xs text-muted-foreground">
                      {activity.project.code} · {activity.project.name}
                      {activity.task ? ` · ${activity.task.title}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description={t.activities.emptyDesc}
            title={t.activities.emptyTitle}
          />
        )}
      </CardContent>
    </Card>
  );
}

