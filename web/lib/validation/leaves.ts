import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(maxLength).nullable().optional(),
  );

const dateSchema = z.coerce.date().refine(
  (value) => !Number.isNaN(value.getTime()),
  "Enter a valid date.",
);

export const employeeLeaveStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const createEmployeeLeaveSchema = z
  .object({
    employeeId: z.string().uuid("Employee ID is invalid."),
    leaveType: z.string().trim().min(1, "Leave type is required.").max(80),
    startDate: dateSchema,
    endDate: dateSchema,
    status: employeeLeaveStatusSchema.default("APPROVED"),
    notes: optionalText(1000).transform((value) => value ?? null),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

export type CreateEmployeeLeaveInput = z.output<typeof createEmployeeLeaveSchema>;

export const updateEmployeeLeaveSchema = z
  .object({
    leaveType: z.string().trim().min(1, "Leave type is required.").max(80).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    status: employeeLeaveStatusSchema.optional(),
    notes: optionalText(1000),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one change.");

export type UpdateEmployeeLeaveInput = z.output<typeof updateEmployeeLeaveSchema>;
