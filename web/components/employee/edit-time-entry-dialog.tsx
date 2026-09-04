"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { patchJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  createTimeEntrySchema,
  type CreateTimeEntryInput,
} from "@/lib/validation/time-entries";

type ProjectOption = { id: string; code: string; name: string };
type TaskOption = { id: string; projectId: string; title: string };
type TimeEntryForm = z.input<typeof createTimeEntrySchema>;

export type TimeEntryEditableProps = {
  id: string;
  projectId: string;
  taskId: string | null;
  startAt: Date | string;
  endAt: Date | string;
  notes: string | null;
};

function toDatetimeLocalString(val: Date | string): string {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function EditTimeEntryDialog({
  entry,
  projects,
  tasks,
}: {
  entry: TimeEntryEditableProps;
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const { formatError, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<TimeEntryForm, unknown, CreateTimeEntryInput>({
    defaultValues: {
      projectId: entry.projectId,
      taskId: entry.taskId ?? "",
      startAt: toDatetimeLocalString(entry.startAt),
      endAt: toDatetimeLocalString(entry.endAt),
      notes: entry.notes ?? "",
    },
    resolver: zodResolver(createTimeEntrySchema),
  });

  const projectId = useWatch({ control, name: "projectId" });
  const availableTasks = tasks.filter((task) => task.projectId === projectId);

  async function onSubmit(values: CreateTimeEntryInput) {
    setRequestError(null);
    try {
      await patchJson(`/api/my/time-entries/${entry.id}`, values);
      setOpen(false);
      router.refresh();
    } catch (caughtError) {
      setRequestError(formatError(caughtError));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      reset({
        projectId: entry.projectId,
        taskId: entry.taskId ?? "",
        startAt: toDatetimeLocalString(entry.startAt),
        endAt: toDatetimeLocalString(entry.endAt),
        notes: entry.notes ?? "",
      });
      setRequestError(null);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" title={t.common.edit}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t.common.edit}</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate">{t.common.edit} Time Entry</DialogTitle>
          <DialogDescription className="break-words">
            Update project, task, or time duration for this log.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 min-w-0"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2 min-w-0">
            <Label htmlFor={`edit-time-project-${entry.id}`}>
              {t.tasks.project}
            </Label>
            <select
              aria-invalid={Boolean(errors.projectId)}
              className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
              id={`edit-time-project-${entry.id}`}
              {...register("projectId")}
            >
              <option value="">{t.tasks.selectProject}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
            {errors.projectId ? (
              <p className="text-xs text-destructive">
                {errors.projectId.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor={`edit-time-task-${entry.id}`}>
              {t.tasks.taskTitle}
            </Label>
            <select
              className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
              id={`edit-time-task-${entry.id}`}
              {...register("taskId")}
            >
              <option value="">—</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            {errors.taskId ? (
              <p className="text-xs text-destructive">
                {errors.taskId.message}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor={`edit-time-start-${entry.id}`}>
                {t.myTime.startTime}
              </Label>
              <Input
                aria-invalid={Boolean(errors.startAt)}
                id={`edit-time-start-${entry.id}`}
                className="w-full min-w-0"
                type="datetime-local"
                {...register("startAt")}
              />
              {errors.startAt ? (
                <p className="text-xs text-destructive">
                  {errors.startAt.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor={`edit-time-end-${entry.id}`}>
                {t.myTime.endTime}
              </Label>
              <Input
                aria-invalid={Boolean(errors.endAt)}
                id={`edit-time-end-${entry.id}`}
                className="w-full min-w-0"
                type="datetime-local"
                {...register("endAt")}
              />
              {errors.endAt ? (
                <p className="text-xs text-destructive">
                  {errors.endAt.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor={`edit-time-notes-${entry.id}`}>
              {t.myTime.notes}
            </Label>
            <Textarea
              aria-invalid={Boolean(errors.notes)}
              className="w-full min-w-0"
              id={`edit-time-notes-${entry.id}`}
              rows={3}
              {...register("notes")}
            />
            {errors.notes ? (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            ) : null}
          </div>
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter className="min-w-0">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
