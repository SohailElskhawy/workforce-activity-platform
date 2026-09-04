import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maxLength).optional(),
  );

export const projectStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
]);

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Project name must have at least 2 characters.")
      .max(160),
    code: z
      .string()
      .trim()
      .min(2, "Project code must have at least 2 characters.")
      .max(32)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Use letters, numbers, hyphens, or underscores only.",
      )
      .transform((value) => value.toUpperCase()),
    description: optionalText(2_000),
    clientName: optionalText(160),
    status: projectStatusSchema.default("PLANNED"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    estimatedHours: z.coerce.number().int().positive().max(100_000).optional(),
  })
  .superRefine(({ endDate, startDate }, context) => {
    if (startDate && endDate && endDate < startDate) {
      context.addIssue({
        code: "custom",
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  });

export type CreateProjectInput = z.output<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Project name must have at least 2 characters.")
      .max(160)
      .optional(),
    code: z
      .string()
      .trim()
      .min(2, "Project code must have at least 2 characters.")
      .max(32)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Use letters, numbers, hyphens, or underscores only.",
      )
      .transform((value) => value.toUpperCase())
      .optional(),
    description: optionalText(2_000),
    clientName: optionalText(160),
    status: projectStatusSchema.optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    estimatedHours: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  })
  .superRefine(({ endDate, startDate }, context) => {
    if (startDate && endDate && endDate < startDate) {
      context.addIssue({
        code: "custom",
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  });

export type UpdateProjectInput = z.output<typeof updateProjectSchema>;
