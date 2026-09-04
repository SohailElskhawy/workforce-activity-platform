import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maxLength).optional(),
  );

export const createEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address."),
    departmentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    position: optionalText(160),
    temporaryPassword: z.string().min(8).max(128),
  })
  .strict();

export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>;

const optionalUuid = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : (value ?? null),
  z.string().uuid().nullable().optional(),
);

export const employeeStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

export const updateEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .optional(),
    phone: optionalText(40),
    departmentId: optionalUuid,
    position: optionalText(160),
    managerId: optionalUuid,
    status: employeeStatusSchema.optional(),
  })
  .strict();

export type UpdateEmployeeInput = z.output<typeof updateEmployeeSchema>;
