import { z } from "zod";

import { ApiError } from "@/lib/http/errors";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
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
  title: z
    .string()
    .trim()
    .min(2, "Task title must have at least 2 characters.")
    .max(160),
  description: optionalText(2_000),
  status: taskStatusSchema.default("TODO"),
  priority: taskPrioritySchema.default("MEDIUM"),
  estimatedMinutes: z.coerce.number().int().positive().max(100_000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const assignEmployeeSchema = z.object({
  employeeId: z.uuid("Select a valid employee."),
});

export function assertDueDateNotPast(dueDate: Date | undefined) {
  if (!dueDate) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  if (normalizedDueDate < today) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Due date cannot be in the past.",
      400,
    );
  }
}

export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type AssignEmployeeInput = z.output<typeof assignEmployeeSchema>;
