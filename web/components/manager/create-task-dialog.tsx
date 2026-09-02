"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { ClientRequestError, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  type CreateTaskInput,
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
} from "@/lib/validation/tasks";

type ProjectOption = { id: string; name: string; code: string };
type CreateTaskForm = z.input<typeof createTaskSchema>;

export function CreateTaskDialog({ projects }: { projects: ProjectOption[] }) {
  const { formatError, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateTaskForm, unknown, CreateTaskInput>({
    defaultValues: {
      priority: "MEDIUM",
      projectId: "",
      status: "TODO",
      title: "",
    },
    resolver: zodResolver(createTaskSchema),
  });

  async function onSubmit(values: CreateTaskInput) {
    setRequestError(null);
    try {
      await postJson("/api/tasks", values);
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button disabled={!projects.length}>
            <Plus />
            {t.tasks.newTask}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate">{t.tasks.createTaskTitle}</DialogTitle>
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
            <Label htmlFor="task-project">{t.tasks.project}</Label>
            <select
              className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
              id="task-project"
              aria-invalid={Boolean(errors.projectId)}
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
            <Label htmlFor="task-title">{t.tasks.taskTitle}</Label>
            <Input
              id="task-title"
              className="w-full min-w-0"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="task-description">{t.projects.description}</Label>
            <Textarea id="task-description" className="w-full min-w-0" {...register("description")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="task-status">{t.projects.status}</Label>
              <select
                className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
                id="task-status"
                {...register("status")}
              >
                {taskStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {status in t.status
                      ? t.status[status as keyof typeof t.status]
                      : status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="task-priority">{t.tasks.priority}</Label>
              <select
                className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
                id="task-priority"
                {...register("priority")}
              >
                {taskPrioritySchema.options.map((priority) => (
                  <option key={priority} value={priority}>
                    {t.priority[priority] ?? priority}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="task-estimate">{t.myTime.duration}</Label>
              <Input
                id="task-estimate"
                className="w-full min-w-0"
                min="1"
                type="number"
                {...register("estimatedMinutes")}
              />
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="task-due-date">{t.tasks.dueDate}</Label>
              <Input
                id="task-due-date"
                className="w-full min-w-0"
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
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.projects.creating : t.tasks.createTaskTitle}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

