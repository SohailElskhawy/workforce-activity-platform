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
  projectStatusSchema,
  updateProjectSchema,
  type UpdateProjectInput,
} from "@/lib/validation/projects";

type UpdateProjectForm = z.input<typeof updateProjectSchema>;

export type ProjectEditableProps = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  clientName: string | null;
  status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  startDate: Date | string | null;
  endDate: Date | string | null;
  estimatedHours: number | null;
};

function toDateInputString(val: Date | string | null | undefined): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function EditProjectDialog({ project }: { project: ProjectEditableProps }) {
  const { formatError, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<UpdateProjectForm, unknown, UpdateProjectInput>({
    defaultValues: {
      name: project.name,
      code: project.code,
      description: project.description ?? "",
      clientName: project.clientName ?? "",
      status: project.status,
      startDate: toDateInputString(project.startDate),
      endDate: toDateInputString(project.endDate),
      estimatedHours: project.estimatedHours ?? undefined,
    },
    resolver: zodResolver(updateProjectSchema),
  });

  async function onSubmit(values: UpdateProjectInput) {
    setRequestError(null);
    try {
      await patchJson(`/api/projects/${project.id}`, values);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      reset({
        name: project.name,
        code: project.code,
        description: project.description ?? "",
        clientName: project.clientName ?? "",
        status: project.status,
        startDate: toDateInputString(project.startDate),
        endDate: toDateInputString(project.endDate),
        estimatedHours: project.estimatedHours ?? undefined,
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
          <DialogTitle className="truncate">{t.common.edit}: {project.name}</DialogTitle>
          <DialogDescription className="break-words">
            {t.projects.createProjectDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 min-w-0"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-name">{t.projects.name}</Label>
            <Input
              id="edit-project-name"
              className="w-full min-w-0"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-code">{t.projects.code}</Label>
            <Input
              id="edit-project-code"
              className="w-full min-w-0 uppercase"
              aria-invalid={Boolean(errors.code)}
              {...register("code")}
            />
            {errors.code ? (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-client">{t.projects.client}</Label>
            <Input
              id="edit-project-client"
              className="w-full min-w-0"
              aria-invalid={Boolean(errors.clientName)}
              {...register("clientName")}
            />
            {errors.clientName ? (
              <p className="text-xs text-destructive">
                {errors.clientName.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-status">{t.projects.status}</Label>
            <select
              aria-invalid={Boolean(errors.status)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="edit-project-status"
              {...register("status")}
            >
              {projectStatusSchema.options.map((status) => (
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
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-project-start">{t.projects.startDate}</Label>
              <Input
                id="edit-project-start"
                type="date"
                aria-invalid={Boolean(errors.startDate)}
                {...register("startDate")}
              />
              {errors.startDate ? (
                <p className="text-xs text-destructive">
                  {errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-project-end">{t.projects.endDate}</Label>
              <Input
                id="edit-project-end"
                type="date"
                aria-invalid={Boolean(errors.endDate)}
                {...register("endDate")}
              />
              {errors.endDate ? (
                <p className="text-xs text-destructive">
                  {errors.endDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-hours">{t.projects.estimatedHours}</Label>
            <Input
              id="edit-project-hours"
              min={0}
              type="number"
              aria-invalid={Boolean(errors.estimatedHours)}
              {...register("estimatedHours")}
            />
            {errors.estimatedHours ? (
              <p className="text-xs text-destructive">
                {errors.estimatedHours.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-project-desc">{t.projects.description}</Label>
            <Textarea
              id="edit-project-desc"
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
