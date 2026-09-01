import { z } from "zod";

export const fileMappingSchema = z.object({
  fileName: z.string().trim().min(1).max(500),
  projectId: z.string().uuid(),
  taskId: z.string().uuid().nullable().optional(),
}).strict();

export type FileMappingInput = z.infer<typeof fileMappingSchema>;
