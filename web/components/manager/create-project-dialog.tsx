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
  type CreateProjectInput,
  createProjectSchema,
  projectStatusSchema,
} from "@/lib/validation/projects";

type CreateProjectForm = z.input<typeof createProjectSchema>;

export function CreateProjectDialog() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateProjectForm, unknown, CreateProjectInput>({
    defaultValues: { code: "", name: "", status: "PLANNED" },
    resolver: zodResolver(createProjectSchema),
  });

  async function onSubmit(values: CreateProjectInput) {
    setRequestError(null);
    try {
      await postJson("/api/projects", values);
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof ClientRequestError
          ? error.message
          : "Unable to create the project.",
      );
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            {t.projects.newProject}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.projects.createProjectTitle}</DialogTitle>
          <DialogDescription>
            {t.projects.createProjectDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="project-name">{t.projects.name}</Label>
            <Input
              id="project-name"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-code">{t.projects.code}</Label>
            <Input
              id="project-code"
              aria-invalid={Boolean(errors.code)}
              {...register("code")}
            />
            {errors.code ? (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-name">{t.projects.client}</Label>
            <Input id="client-name" {...register("clientName")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">{t.projects.description}</Label>
            <Textarea id="project-description" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="project-status">{t.projects.status}</Label>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="project-status"
                {...register("status")}
              >
                {projectStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {status in t.status
                      ? t.status[status as keyof typeof t.status]
                      : status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimated-hours">{t.projects.estimatedHours}</Label>
              <Input
                id="estimated-hours"
                min="1"
                type="number"
                {...register("estimatedHours")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="project-start">{t.projects.startDate}</Label>
              <Input
                id="project-start"
                type="date"
                {...register("startDate")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-end">{t.projects.endDate}</Label>
              <Input id="project-end" type="date" {...register("endDate")} />
            </div>
          </div>
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.projects.creating : t.projects.createButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

