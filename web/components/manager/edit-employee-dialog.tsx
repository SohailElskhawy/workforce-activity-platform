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
import { patchJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  employeeStatusSchema,
  updateEmployeeSchema,
  type UpdateEmployeeInput,
} from "@/lib/validation/employees";

type UpdateEmployeeForm = z.input<typeof updateEmployeeSchema>;

export type EmployeeEditableProps = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  departmentId: string | null;
};

type DepartmentOption = { id: string; name: string };

export function EditEmployeeDialog({
  employee,
  departments,
}: {
  employee: EmployeeEditableProps;
  departments: DepartmentOption[];
}) {
  const { formatError, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<UpdateEmployeeForm, unknown, UpdateEmployeeInput>({
    defaultValues: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? "",
      position: employee.position ?? "",
      status: employee.status,
      departmentId: employee.departmentId ?? "",
    },
    resolver: zodResolver(updateEmployeeSchema),
  });

  const selectedStatus = watch("status");

  async function onSubmit(values: UpdateEmployeeInput) {
    setRequestError(null);
    try {
      await patchJson(`/api/employees/${employee.id}`, values);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      reset({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone ?? "",
        position: employee.position ?? "",
        status: employee.status,
        departmentId: employee.departmentId ?? "",
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
            {t.common.edit}: {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription className="break-words">
            {t.employees.createEmployeeDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 min-w-0"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-first">{t.employees.firstName}</Label>
              <Input
                id="edit-emp-first"
                className="w-full min-w-0"
                aria-invalid={Boolean(errors.firstName)}
                {...register("firstName")}
              />
              {errors.firstName ? (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-last">{t.employees.lastName}</Label>
              <Input
                id="edit-emp-last"
                className="w-full min-w-0"
                aria-invalid={Boolean(errors.lastName)}
                {...register("lastName")}
              />
              {errors.lastName ? (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="edit-emp-email">{t.employees.email}</Label>
            <Input
              id="edit-emp-email"
              type="email"
              className="w-full min-w-0"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-phone">Phone</Label>
              <Input
                id="edit-emp-phone"
                className="w-full min-w-0"
                aria-invalid={Boolean(errors.phone)}
                {...register("phone")}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">
                  {errors.phone.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-position">{t.employees.role}</Label>
              <Input
                id="edit-emp-position"
                className="w-full min-w-0"
                aria-invalid={Boolean(errors.position)}
                {...register("position")}
              />
              {errors.position ? (
                <p className="text-xs text-destructive">
                  {errors.position.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-dept">{t.employees.department}</Label>
              <select
                aria-invalid={Boolean(errors.departmentId)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="edit-emp-dept"
                {...register("departmentId")}
              >
                <option value="">{t.tasks.unassigned}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="edit-emp-status">{t.projects.status}</Label>
              <select
                aria-invalid={Boolean(errors.status)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                id="edit-emp-status"
                {...register("status")}
              >
                {employeeStatusSchema.options.map((st) => (
                  <option key={st} value={st}>
                    {st === "ACTIVE"
                      ? "Active"
                      : st === "INACTIVE"
                        ? "Inactive"
                        : "Suspended"}
                  </option>
                ))}
              </select>
              {errors.status ? (
                <p className="text-xs text-destructive">
                  {errors.status.message}
                </p>
              ) : null}
            </div>
          </div>
          {selectedStatus && selectedStatus !== "ACTIVE" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              Setting employee to {selectedStatus} will immediately block portal
              login and deactivate all linked agent devices.
            </div>
          ) : null}
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
