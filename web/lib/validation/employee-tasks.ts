import { z } from "zod";

import { taskStatusSchema } from "@/lib/validation/tasks";

export const updateOwnTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

export type UpdateOwnTaskStatusInput = z.output<
  typeof updateOwnTaskStatusSchema
>;
