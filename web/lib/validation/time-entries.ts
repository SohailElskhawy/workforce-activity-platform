import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.uuid("Select a valid task.").optional(),
);

const optionalNotes = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(1_000).optional(),
);

export const createTimeEntrySchema = z.object({
  projectId: z.uuid("Select a valid project."),
  taskId: optionalUuid,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  notes: optionalNotes,
}).strict();

export type CreateTimeEntryInput = z.output<typeof createTimeEntrySchema>;
