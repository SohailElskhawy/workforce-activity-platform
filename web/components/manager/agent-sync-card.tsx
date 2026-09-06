"use client";

import { Activity, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export function AgentSyncCard({
  configVersion,
  updatedAt,
}: {
  configVersion: number;
  updatedAt: Date | string;
}) {
  const { t } = useI18n();

  const formattedDate = new Date(updatedAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            <CardTitle>{t.settings.agentConfigCard.title}</CardTitle>
          </div>
          <Badge className="font-mono text-xs" variant="outline">
            v{configVersion}
          </Badge>
        </div>
        <CardDescription>
          {t.settings.agentConfigCard.desc}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.settings.agentConfigCard.configVersionLabel}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                v{configVersion}
              </span>
              <span className="text-xs text-muted-foreground">
                ({t.settings.agentConfigCard.configVersionHelp})
              </span>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.settings.agentConfigCard.lastUpdatedLabel}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
          <Activity className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="space-y-1">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {t.settings.agentConfigCard.syncNoticeTitle}
            </p>
            <p className="text-muted-foreground">
              {t.settings.agentConfigCard.syncNoticeDesc}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
