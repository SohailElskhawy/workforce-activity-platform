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
import {
  type CreateTaskInput,
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
} from "@/lib/validation/tasks";

type ProjectOption = { id: string; name: string; code: string };
type CreateTaskForm = z.input<typeof createTaskSchema>;

export function CreateTaskDialog({ projects }: { projects: ProjectOption[] }) {
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
      setRequestError(
        error instanceof ClientRequestError
          ? error.message
          : "Unable to create the task.",
      );
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button disabled={!projects.length}>
            <Plus />
            New task
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Add a task to one of your company projects.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="task-project">Project</Label>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="task-project"
              aria-invalid={Boolean(errors.projectId)}
              {...register("projectId")}
            >
              <option value="">Select a project</option>
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
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-status">Status</Label>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="task-status"
                {...register("status")}
              >
                {taskStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="task-priority"
                {...register("priority")}
              >
                {taskPrioritySchema.options.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-estimate">Estimated minutes</Label>
              <Input
                id="task-estimate"
                min="1"
                type="number"
                {...register("estimatedMinutes")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
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
              {isSubmitting ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
