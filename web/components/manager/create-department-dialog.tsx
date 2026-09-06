"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Plus } from "lucide-react";
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
import { FormAlert, FormField } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import {
  createDepartmentSchema,
  type CreateDepartmentInput,
} from "@/lib/validation/departments";

type CreateDepartmentForm = z.input<typeof createDepartmentSchema>;

export type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function CreateDepartmentDialog({
  managers,
}: {
  managers: ManagerOption[];
}) {
  const { formatError, t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateDepartmentForm, unknown, CreateDepartmentInput>({
    defaultValues: {
      name: "",
      managerId: null,
    },
    resolver: zodResolver(createDepartmentSchema),
  });

  function closeDialog() {
    reset();
    setRequestError(null);
    setOpen(false);
  }

  async function onSubmit(values: CreateDepartmentInput) {
    setRequestError(null);
    try {
      await postJson("/api/departments", values);
      toast({
        title: t.departments.createdSuccess,
        variant: "success",
      });
      closeDialog();
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}
      open={open}
    >
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="size-4" />
            <span>{t.departments.newDepartment}</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Building2 className="size-5 text-primary" />
            <DialogTitle>{t.departments.createDepartmentTitle}</DialogTitle>
          </div>
          <DialogDescription>
            {t.departments.createDepartmentDesc}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormAlert message={requestError} />

          <FormField
            error={errors.name?.message}
            htmlFor="dept-name"
            label={t.departments.name}
            required
          >
            <Input
              id="dept-name"
              placeholder={t.departments.namePlaceholder}
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
          </FormField>

          <FormField
            error={errors.managerId?.message}
            htmlFor="dept-manager"
            label={t.departments.manager}
          >
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id="dept-manager"
              {...register("managerId")}
            >
              <option value="">{t.departments.noManager}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.email})
                </option>
              ))}
            </select>
          </FormField>

          <DialogFooter className="gap-2 pt-2">
            <Button
              disabled={isSubmitting}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              {t.common.cancel}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.departments.createDepartmentTitle}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
