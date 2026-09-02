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
