"use client";

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

type ApplicationBreakdownProps = {
  applications: Array<{ name: string; durationSeconds: number }>;
};

export function ApplicationBreakdown({
  applications,
}: ApplicationBreakdownProps) {
  const { locale, t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.activities.applicationBreakdown}</CardTitle>
        <CardDescription>
          {t.activities.subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length ? (
          <div className="space-y-3">
            {applications.map((application) => (
              <div
                className="flex items-center justify-between gap-4 text-sm"
                key={application.name}
              >
                <span className="font-medium">{application.name}</span>
                <span className="text-muted-foreground">
                  {formatDurationFromSeconds(application.durationSeconds, locale)}
                </span>
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

