"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useState } from "react";
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
import { ClientRequestError, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  type FileMappingInput,
  fileMappingSchema,
} from "@/lib/validation/file-mappings";

type ProjectOption = { id: string; code: string; name: string };
type TaskOption = { id: string; project: { id: string }; title: string };
type FileMappingForm = z.input<typeof fileMappingSchema>;

export function MapFileDialog({
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
  } = useForm<FileMappingForm, unknown, FileMappingInput>({
    defaultValues: { fileName: "", projectId: "", taskId: null },
    resolver: zodResolver(fileMappingSchema),
  });
  const projectId = useWatch({ control, name: "projectId" });
  const projectTasks = tasks.filter((task) => task.project.id === projectId);

  async function onSubmit(values: FileMappingInput) {
    setRequestError(null);
    try {
      await postJson("/api/file-mappings", values);
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof ClientRequestError
          ? error.message
          : "Unable to save the file mapping.",
      );
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button disabled={!projects.length}>
            <Link2 />
            {t.activities.mapFile}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.activities.mapFile}</DialogTitle>
          <DialogDescription>
            {t.activities.mapFileDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="mapping-file">DWG filename</Label>
            <Input
              aria-invalid={Boolean(errors.fileName)}
              id="mapping-file"
              placeholder="ABC_A_Block.dwg"
              {...register("fileName")}
            />
            {errors.fileName ? (
              <p className="text-xs text-destructive">
                {errors.fileName.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mapping-project">{t.tasks.project}</Label>
            <select
              aria-invalid={Boolean(errors.projectId)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="mapping-project"
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
            <Label htmlFor="mapping-task">{t.tasks.taskTitle}</Label>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              id="mapping-task"
              {...register("taskId", { setValueAs: (value) => value || null })}
            >
              <option value="">—</option>
              {projectTasks.map((task) => (
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
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

