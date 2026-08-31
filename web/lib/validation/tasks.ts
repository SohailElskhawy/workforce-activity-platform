import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

export const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "COMPLETED",
  "CANCELLED",
]);

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createTaskSchema = z.object({
  projectId: z.uuid("Select a valid project."),
  title: z.string().trim().min(2, "Task title must have at least 2 characters.").max(160),
  description: optionalText(2_000),
  status: taskStatusSchema.default("TODO"),
  priority: taskPrioritySchema.default("MEDIUM"),
  estimatedMinutes: z.coerce.number().int().positive().max(100_000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const assignEmployeeSchema = z.object({
  employeeId: z.uuid("Select a valid employee."),
});

export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type AssignEmployeeInput = z.output<typeof assignEmployeeSchema>;
