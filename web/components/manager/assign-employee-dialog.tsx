"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { Label } from "@/components/ui/label";
import { ClientRequestError, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import {
  type AssignEmployeeInput,
  assignEmployeeSchema,
} from "@/lib/validation/tasks";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function AssignEmployeeDialog({
  employees,
  taskId,
}: {
  employees: EmployeeOption[];
  taskId: string;
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
  } = useForm<AssignEmployeeInput>({
    defaultValues: { employeeId: "" },
    resolver: zodResolver(assignEmployeeSchema),
  });

  async function onSubmit(values: AssignEmployeeInput) {
    setRequestError(null);
    try {
      await postJson(`/api/tasks/${taskId}/assignments`, values);
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
          <Button disabled={!employees.length} variant="outline">
            <UserPlus />
            {t.tasks.assignEmployeeTitle}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate">{t.tasks.assignEmployeeTitle}</DialogTitle>
          <DialogDescription className="break-words">
            {t.tasks.assignEmployeeDesc}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 min-w-0"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="assignment-employee">{t.common.employee}</Label>
            <select
              className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm truncate"
              id="assignment-employee"
              aria-invalid={Boolean(errors.employeeId)}
              {...register("employeeId")}
            >
              <option value="">{t.tasks.selectEmployees}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} — {employee.email}
                </option>
              ))}
            </select>
            {errors.employeeId ? (
              <p className="text-xs text-destructive">
                {errors.employeeId.message}
              </p>
            ) : null}
          </div>
          {requestError ? (
            <p className="text-sm text-destructive">{requestError}</p>
          ) : null}
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.tasks.assignEmployeeTitle}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

