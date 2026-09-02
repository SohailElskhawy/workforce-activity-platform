"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { ClientRequestError, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  type CreateTimeEntryInput,
  createTimeEntrySchema,
} from "@/lib/validation/time-entries";

type ProjectOption = { id: string; code: string; name: string };
type TaskOption = { id: string; projectId: string; title: string };
type TimeEntryForm = z.input<typeof createTimeEntrySchema>;

export function AddTimeEntryDialog({
  projects,
  tasks,
}: {
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const { t } = useI18n();
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
    defaultValues: { projectId: "", taskId: "" },
    resolver: zodResolver(createTimeEntrySchema),
  });
  const projectId = useWatch({ control, name: "projectId" });
  const availableTasks = tasks.filter((task) => task.projectId === projectId);

  async function onSubmit(values: CreateTimeEntryInput) {
    setRequestError(null);
    try {
      await postJson("/api/my/time-entries", values);
      reset();
      setOpen(false);
      router.refresh();
    } catch (caughtError) {
      setRequestError(
        caughtError instanceof ClientRequestError
          ? caughtError.message
          : "Unable to add the time entry.",
      );
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button disabled={!projects.length}>
            <Plus />
            {t.myTime.addTimeEntry}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.myTime.addTimeEntryTitle}</DialogTitle>
          <DialogDescription>
            {t.myTime.addTimeEntryDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="time-project">{t.tasks.project}</Label>
            <select
              aria-invalid={Boolean(errors.projectId)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="time-project"
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
          <div className="grid gap-2">
            <Label htmlFor="time-task">{t.tasks.taskTitle}</Label>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="time-task"
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="time-start">{t.myTime.startTime}</Label>
              <Input
                aria-invalid={Boolean(errors.startAt)}
                id="time-start"
                type="datetime-local"
                {...register("startAt")}
              />
              {errors.startAt ? (
                <p className="text-xs text-destructive">
                  {errors.startAt.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time-end">{t.myTime.endTime}</Label>
              <Input
                aria-invalid={Boolean(errors.endAt)}
                id="time-end"
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
          <div className="grid gap-2">
            <Label htmlFor="time-notes">{t.myTime.notes}</Label>
            <Textarea id="time-notes" placeholder={t.myTime.notesPlaceholder} {...register("notes")} />
          </div>
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.myTime.addTimeEntry}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

