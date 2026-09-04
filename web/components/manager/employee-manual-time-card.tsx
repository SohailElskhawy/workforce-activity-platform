"use client";

import { Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDurationFromMinutes, formatTime } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

export type ManualTimeEntryRecord = {
  id: string;
  startAt: Date | string;
  endAt: Date | string;
  durationMinutes: number;
  notes: string | null;
  project: {
    id: string;
    name: string;
    code: string;
  };
  task: {
    id: string;
    title: string;
  } | null;
};

export function EmployeeManualTimeCard({
  entries,
  selectedDate,
}: {
  entries: ManualTimeEntryRecord[];
  selectedDate: string;
}) {
  const { locale, t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {t.myTime.title} ({selectedDate})
        </CardTitle>
        <CardDescription>
          Individual manual time logs submitted by the employee for this day.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.tasks.project}</TableHead>
                <TableHead>{t.tasks.taskTitle}</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>{t.myTime.duration}</TableHead>
                <TableHead>{t.myTime.notes}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {entry.project.code} — {entry.project.name}
                  </TableCell>
                  <TableCell>{entry.task?.title ?? "—"}</TableCell>
                  <TableCell>{formatTime(entry.startAt, locale)}</TableCell>
                  <TableCell>{formatTime(entry.endAt, locale)}</TableCell>
                  <TableCell>
                    {formatDurationFromMinutes(entry.durationMinutes, locale)}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {entry.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No manual time entries recorded for this date.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
