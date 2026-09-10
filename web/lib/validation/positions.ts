import { z } from "zod";

export const createPositionSchema = z
  .object({
    name: z.string().trim().min(1, "Position name is required.").max(160),
  })
  .strict();

export type CreatePositionInput = z.output<typeof createPositionSchema>;

export const optionalPositionId = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().uuid().nullable(),
  )
  .optional()
  .transform((value) => value ?? null);

export const employeePositionIdSchema = z
  .object({ positionId: optionalPositionId })
  .strict();
