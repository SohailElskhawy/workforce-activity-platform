import { z } from "zod";
import { ApiError } from "@/lib/http/errors";
import { createEmployeeSchema } from "@/lib/validation/employees";

export const companySchema = z
  .object({ name: z.string().trim().min(2).max(160) })
  .strict();
export const roleSchema = z.enum(["SUPER_ADMIN", "MANAGER", "EMPLOYEE"]);
export const createUserSchema = z
  .object({
    companyId: z.string().uuid(),
    role: roleSchema,
    email: createEmployeeSchema.shape.email,
    temporaryPassword: createEmployeeSchema.shape.temporaryPassword.refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
    ),
    firstName: createEmployeeSchema.shape.firstName.optional(),
    lastName: createEmployeeSchema.shape.lastName.optional(),
  })
  .strict()
  .refine((v) => v.role !== "EMPLOYEE" || Boolean(v.firstName && v.lastName));
export const updateUserSchema = z
  .object({ companyId: z.string().uuid(), role: roleSchema })
  .strict();
export const idSchema = z.string().uuid();
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(160).optional(),
    companyId: z.string().uuid().optional(),
    role: roleSchema.optional(),
    actor: z.string().trim().max(160).optional(),
    action: z.string().trim().max(100).optional(),
    entityType: z.string().trim().max(100).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      "VALIDATION_ERROR",
      "Invalid administration input.",
      400,
    );
  return result.data;
}
export function parseAdminQuery(params: URLSearchParams) {
  return parse(
    querySchema,
    Object.fromEntries([...params].filter(([, v]) => v !== "")),
  );
}
export type AdminQuery = ReturnType<typeof parseAdminQuery>;
