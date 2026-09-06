"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil } from "lucide-react";
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
import { patchJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import {
  updateDepartmentSchema,
  type UpdateDepartmentInput,
} from "@/lib/validation/departments";

import type { ManagerOption } from "./create-department-dialog";

type UpdateDepartmentForm = z.input<typeof updateDepartmentSchema>;

export function EditDepartmentDialog({
  department,
  managers,
}: {
  department: {
    id: string;
    name: string;
    managerId: string | null;
  };
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
  } = useForm<UpdateDepartmentForm, unknown, UpdateDepartmentInput>({
    defaultValues: {
      name: department.name,
      managerId: department.managerId ?? "",
    },
    resolver: zodResolver(updateDepartmentSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      reset({
        name: department.name,
        managerId: department.managerId ?? "",
      });
      setRequestError(null);
    }
    setOpen(nextOpen);
  }

  async function onSubmit(values: UpdateDepartmentInput) {
    setRequestError(null);
    try {
      await patchJson(`/api/departments/${department.id}`, values);
      toast({
        title: t.departments.updatedSuccess,
        variant: "success",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <Pencil className="size-3.5" />
            <span>{t.common.edit}</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Building2 className="size-5 text-primary" />
            <DialogTitle>{t.departments.editDepartmentTitle}</DialogTitle>
          </div>
          <DialogDescription>
            {t.departments.editDepartmentDesc}
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
            htmlFor={`edit-dept-name-${department.id}`}
            label={t.departments.name}
            required
          >
            <Input
              id={`edit-dept-name-${department.id}`}
              placeholder={t.departments.namePlaceholder}
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
          </FormField>

          <FormField
            error={errors.managerId?.message}
            htmlFor={`edit-dept-manager-${department.id}`}
            label={t.departments.manager}
          >
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id={`edit-dept-manager-${department.id}`}
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
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {t.common.cancel}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
