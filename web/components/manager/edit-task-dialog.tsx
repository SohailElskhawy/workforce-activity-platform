"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
  taskPrioritySchema,
  taskStatusSchema,
  updateTaskSchema,
  type UpdateTaskInput,
} from "@/lib/validation/tasks";

type UpdateTaskForm = z.input<typeof updateTaskSchema>;

export type TaskEditableProps = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "REVIEW" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedMinutes: number | null;
  dueDate: Date | string | null;
};

function toDateInputString(val: Date | string | null | undefined): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function EditTaskDialog({ task }: { task: TaskEditableProps }) {
  const { formatError, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<UpdateTaskForm, unknown, UpdateTaskInput>({
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes ?? undefined,
      dueDate: toDateInputString(task.dueDate),
    },
    resolver: zodResolver(updateTaskSchema),
  });

  async function onSubmit(values: UpdateTaskInput) {
    setRequestError(null);
    try {
      await patchJson(`/api/tasks/${task.id}`, values);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      reset({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        dueDate: toDateInputString(task.dueDate),
      });
      setRequestError(null);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Pencil />
            {t.common.edit}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate">
            {t.common.edit}: {task.title}
          </DialogTitle>
          <DialogDescription className="break-words">
            {t.tasks.createTaskDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 min-w-0"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-task-title">{t.tasks.taskTitle}</Label>
            <Input
              id="edit-task-title"
              className="w-full min-w-0"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-task-status">{t.projects.status}</Label>
              <select
                aria-invalid={Boolean(errors.status)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="edit-task-status"
                {...register("status")}
              >
                {taskStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {t.status[status]}
                  </option>
                ))}
              </select>
              {errors.status ? (
                <p className="text-xs text-destructive">
                  {errors.status.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-task-priority">{t.tasks.priority}</Label>
              <select
                aria-invalid={Boolean(errors.priority)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="edit-task-priority"
                {...register("priority")}
              >
                {taskPrioritySchema.options.map((priority) => (
                  <option key={priority} value={priority}>
                    {t.priority[priority]}
                  </option>
                ))}
              </select>
              {errors.priority ? (
                <p className="text-xs text-destructive">
                  {errors.priority.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-task-minutes">{t.myTime.duration} (min)</Label>
              <Input
                id="edit-task-minutes"
                min={0}
                type="number"
                aria-invalid={Boolean(errors.estimatedMinutes)}
                {...register("estimatedMinutes")}
              />
              {errors.estimatedMinutes ? (
                <p className="text-xs text-destructive">
                  {errors.estimatedMinutes.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-task-due">{t.tasks.dueDate}</Label>
              <Input
                id="edit-task-due"
                type="date"
                aria-invalid={Boolean(errors.dueDate)}
                {...register("dueDate")}
              />
              {errors.dueDate ? (
                <p className="text-xs text-destructive">
                  {errors.dueDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-task-desc">{t.projects.description}</Label>
            <Textarea
              id="edit-task-desc"
              rows={3}
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
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
