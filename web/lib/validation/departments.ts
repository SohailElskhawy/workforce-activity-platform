import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  },
  z.string().uuid("Invalid manager ID.").nullable().optional(),
);

export const createDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Department name is required.")
      .max(100, "Department name cannot exceed 100 characters."),
    managerId: optionalUuid.transform((val) => val ?? null),
  })
  .strict();

export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Department name is required.")
      .max(100, "Department name cannot exceed 100 characters.")
      .optional(),
    managerId: optionalUuid,
  })
  .strict();

export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
