import { z } from "zod";

export const createPositionSchema = z
  .object({
    name: z.string().trim().min(1, "Position name is required.").max(160),
  })
  .strict();

export type CreatePositionInput = z.output<typeof createPositionSchema>;

export const positionIdPattern =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|legacy-position-[0-9a-fA-F]{32})$/;

export const positionIdSchema = z
  .string()
  .trim()
  .regex(positionIdPattern, "Position ID is invalid.");

export const optionalPositionId = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : (value ?? null)),
    positionIdSchema.nullable(),
  )
  .optional()
  .transform((value) => value ?? null);

export const employeePositionIdSchema = z
  .object({ positionId: optionalPositionId })
  .strict();
