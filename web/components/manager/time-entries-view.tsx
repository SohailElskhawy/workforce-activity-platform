"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { DataTableCard } from "@/components/ui/data-table";
import { FilterBar, FilterReset, FilterSelect } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDurationFromMinutes, formatTime } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

export type CompanyTimeEntryViewItem = {
  id: string;
  projectId: string;
  taskId: string | null;
  employeeId: string;
  startAt: Date | string;
  endAt: Date | string;
  durationMinutes: number;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    departmentId: string | null;
    department: { id: string; name: string } | null;
  };
  project: { id: string; code: string; name: string };
  task: { id: string; title: string } | null;
};

type Option = { id: string; name: string };

export function TimeEntriesView({
  entries,
  employees,
  departments,
  projects,
  tasks,
}: {
  entries: CompanyTimeEntryViewItem[];
  employees: Array<{ id: string; firstName: string; lastName: string }>;
  departments: Option[];
  projects: Array<{ id: string; code: string; name: string }>;
  tasks: Array<{ id: string; title: string; projectId: string }>;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedDate = searchParams.get("date") ?? "";
  const selectedEmployeeId = searchParams.get("employeeId") ?? "";
  const selectedDepartmentId = searchParams.get("departmentId") ?? "";
  const selectedProjectId = searchParams.get("projectId") ?? "";
  const selectedTaskId = searchParams.get("taskId") ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const current = new URLSearchParams(searchParams.toString());
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
      startTransition(() => {
        router.push(`/time-entries?${current.toString()}`);
      });
    },
    [router, searchParams],
  );

  const resetFilters = useCallback(() => {
    startTransition(() => {
      router.push("/time-entries");
    });
  }, [router]);

  const hasFilters = Boolean(
    selectedDate ||
      selectedEmployeeId ||
      selectedDepartmentId ||
      selectedProjectId ||
      selectedTaskId,
  );

  const availableTasks = selectedProjectId
    ? tasks.filter((task) => task.projectId === selectedProjectId)
    : tasks;

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="flex items-center gap-2">
          <Input
            aria-label={t.timeEntries.filterByDate}
            className="h-9 w-40 text-sm"
            onChange={(e) => updateParam("date", e.target.value)}
            type="date"
            value={selectedDate}
          />
        </div>

        <FilterSelect
          allLabel={t.timeEntries.allEmployees}
          ariaLabel={t.timeEntries.employee}
          onValueChange={(val) => updateParam("employeeId", val)}
          options={employees.map((emp) => ({
            value: emp.id,
            label: `${emp.firstName} ${emp.lastName}`,
          }))}
          placeholder={t.timeEntries.employee}
          value={selectedEmployeeId}
        />

        <FilterSelect
          allLabel={t.timeEntries.allDepartments}
          ariaLabel={t.timeEntries.department}
          onValueChange={(val) => updateParam("departmentId", val)}
          options={departments.map((dept) => ({
            value: dept.id,
            label: dept.name,
          }))}
          placeholder={t.timeEntries.department}
          value={selectedDepartmentId}
        />

        <FilterSelect
          allLabel={t.timeEntries.allProjects}
          ariaLabel={t.timeEntries.project}
          onValueChange={(val) => {
            updateParam("projectId", val);
            if (val !== selectedProjectId) {
              updateParam("taskId", "");
            }
          }}
          options={projects.map((proj) => ({
            value: proj.id,
            label: `${proj.code} — ${proj.name}`,
          }))}
          placeholder={t.timeEntries.project}
          value={selectedProjectId}
        />

        <FilterSelect
          allLabel={t.timeEntries.allTasks}
          ariaLabel={t.timeEntries.task}
          onValueChange={(val) => updateParam("taskId", val)}
          options={availableTasks.map((tsk) => ({
            value: tsk.id,
            label: tsk.title,
          }))}
          placeholder={t.timeEntries.task}
          value={selectedTaskId}
        />

        <FilterReset
          disabled={!hasFilters || isPending}
          onReset={resetFilters}
        />
      </FilterBar>

      <DataTableCard>
        {entries.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.timeEntries.employee}</TableHead>
                <TableHead>{t.timeEntries.department}</TableHead>
                <TableHead>{t.timeEntries.date}</TableHead>
                <TableHead>{t.timeEntries.project}</TableHead>
                <TableHead>{t.timeEntries.task}</TableHead>
                <TableHead>{t.timeEntries.startTime}</TableHead>
                <TableHead>{t.timeEntries.endTime}</TableHead>
                <TableHead>{t.timeEntries.duration}</TableHead>
                <TableHead>{t.timeEntries.notes}</TableHead>
                <TableHead className="text-right">{t.timeEntries.lastModified}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div>{entry.employee.firstName} {entry.employee.lastName}</div>
                    <div className="text-xs text-muted-foreground">{entry.employee.email}</div>
                  </TableCell>
                  <TableCell>
                    {entry.employee.department?.name ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(new Date(entry.startAt), locale)}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-900">{entry.project.code}</span>
                    <span className="text-xs text-muted-foreground ml-1">({entry.project.name})</span>
                  </TableCell>
                  <TableCell className="max-w-44 truncate">
                    {entry.task?.title ?? "—"}
                  </TableCell>
                  <TableCell>{formatTime(entry.startAt, locale)}</TableCell>
                  <TableCell>{formatTime(entry.endAt, locale)}</TableCell>
                  <TableCell className="font-semibold">
                    {formatDurationFromMinutes(entry.durationMinutes, locale)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate" title={entry.notes ?? ""}>
                    {entry.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDate(new Date(entry.updatedAt), locale)} {formatTime(entry.updatedAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            description={t.timeEntries.emptyDesc}
            title={t.timeEntries.emptyTitle}
          />
        )}
      </DataTableCard>
    </div>
  );
}
