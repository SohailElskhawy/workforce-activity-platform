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

import { getZonedDayBounds } from "@/lib/time/timezone";

export function assertDueDateNotPast(dueDate: Date | undefined) {
  if (!dueDate) return;

  const today = getZonedDayBounds(new Date()).startAt;
  const normalizedDueDate = getZonedDayBounds(dueDate).startAt;

  if (normalizedDueDate < today) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Due date cannot be in the past.",
      400,
    );
  }
}

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Task title must have at least 2 characters.")
    .max(160)
    .optional(),
  description: optionalText(2_000),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.output<typeof updateTaskSchema>;
export type AssignEmployeeInput = z.output<typeof assignEmployeeSchema>;
