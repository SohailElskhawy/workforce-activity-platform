"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
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
import { ClientRequestError, postJson } from "@/lib/client/api";
import {
  type CreateEmployeeInput,
  createEmployeeSchema,
} from "@/lib/validation/employees";

type CreateEmployeeForm = z.input<typeof createEmployeeSchema>;
type DepartmentOption = { id: string; name: string };

export function CreateEmployeeDialog({
  departments,
}: {
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateEmployeeForm, unknown, CreateEmployeeInput>({
    defaultValues: {
      departmentId: null,
      email: "",
      firstName: "",
      lastName: "",
      position: "",
      temporaryPassword: "",
    },
    resolver: zodResolver(createEmployeeSchema),
  });

  function closeDialog() {
    reset();
    setCreatedEmail(null);
    setRequestError(null);
    setOpen(false);
  }

  async function onSubmit(values: CreateEmployeeInput) {
    setRequestError(null);
    try {
      const employee = await postJson<{ email: string; id: string }>(
        "/api/employees",
        values,
      );
      if (!employee) throw new ClientRequestError("Invalid employee response.");
      setCreatedEmail(employee.email);
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof ClientRequestError
          ? error.message
          : "Unable to create the employee.",
      );
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}
      open={open}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus />
            Add employee
          </Button>
        }
      />
      <DialogContent>
        {createdEmail ? (
          <>
            <DialogHeader>
              <DialogTitle>Employee created</DialogTitle>
              <DialogDescription>
                {createdEmail} can now sign in. Share the temporary password you
                entered through an approved secure channel; it is not stored or
                shown again here.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={closeDialog} type="button">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add employee</DialogTitle>
              <DialogDescription>
                This creates an active employee and their WorkLens login.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              noValidate
              onSubmit={handleSubmit(onSubmit)}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field
                  error={errors.firstName?.message}
                  label="First name"
                  name="employee-first-name"
                >
                  <Input id="employee-first-name" {...register("firstName")} />
                </Field>
                <Field
                  error={errors.lastName?.message}
                  label="Last name"
                  name="employee-last-name"
                >
                  <Input id="employee-last-name" {...register("lastName")} />
                </Field>
              </div>
              <Field
                error={errors.email?.message}
                label="Work email"
                name="employee-email"
              >
                <Input
                  id="employee-email"
                  type="email"
                  {...register("email")}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  error={errors.departmentId?.message}
                  label="Department"
                  name="employee-department"
                >
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    id="employee-department"
                    {...register("departmentId", {
                      setValueAs: (value) => value || null,
                    })}
                  >
                    <option value="">No department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  error={errors.position?.message}
                  label="Position"
                  name="employee-position"
                >
                  <Input id="employee-position" {...register("position")} />
                </Field>
              </div>
              <Field
                error={errors.temporaryPassword?.message}
                label="Temporary password"
                name="employee-password"
              >
                <Input
                  id="employee-password"
                  type="password"
                  {...register("temporaryPassword")}
                />
              </Field>
              {requestError ? (
                <p className="text-sm text-destructive">{requestError}</p>
              ) : null}
              <DialogFooter>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Creating…" : "Create employee"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  error,
  label,
  name,
}: {
  children: React.ReactNode;
  error: string | undefined;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
