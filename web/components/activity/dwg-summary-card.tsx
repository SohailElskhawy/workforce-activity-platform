"use client";

import { Box } from "lucide-react";
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
import type { DwgSummaryRow } from "@/lib/services/dwg-reports";

export function DwgSummaryCard({ items }: { items: DwgSummaryRow[] }) {
  const { locale } = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          <CardTitle>AutoCAD Drawings</CardTitle>
        </div>
        <CardDescription>
          Active DWG drawing time tracked for this date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="divide-y rounded-md border">
            {items.map((item, index) => (
              <div
                key={`${item.normalizedFileName}-${item.projectId}-${item.taskId}-${index}`}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.fileName}</span>
                    <Badge variant={item.isMapped ? "default" : "secondary"}>
                      {item.isMapped ? "Mapped" : "Unmapped"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.projectName
                      ? `${item.projectCode ? `${item.projectCode} · ` : ""}${item.projectName}${item.taskTitle ? ` · ${item.taskTitle}` : ""}`
                      : "Not assigned to any project"}
                  </p>
                </div>
                <div className="font-medium text-foreground sm:text-right">
                  {formatDurationFromSeconds(item.activeSeconds, locale)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No active AutoCAD drawing time detected for this date."
            title="No AutoCAD drawings"
          />
        )}
      </CardContent>
    </Card>
  );
}
