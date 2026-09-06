import { z } from "zod";

export function normalizeProcessName(raw: string): string {
  const trimmed = raw.trim();
  const normalizedPath = trimmed.replaceAll("/", "\\");
  const segments = normalizedPath.split("\\");
  const base = (segments.at(-1) ?? "").toLowerCase().trim();
  if (!base) return "";
  return base.endsWith(".exe") ? base : `${base}.exe`;
}

export const updateTrackingSettingsSchema = z
  .object({
    idleThresholdSeconds: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          const parsed = Number.parseInt(val.trim(), 10);
          return Number.isNaN(parsed) ? undefined : parsed;
        }
        return val;
      },
      z
        .number()
        .int("Idle threshold must be an integer number of seconds.")
        .min(30, "Idle threshold must be at least 30 seconds.")
        .max(14400, "Idle threshold cannot exceed 4 hours (14,400 seconds)."),
    ),
  })
  .strict();

export type UpdateTrackingSettingsInput = z.output<
  typeof updateTrackingSettingsSchema
>;

export const addExcludedApplicationSchema = z
  .object({
    processName: z
      .string()
      .trim()
      .min(1, "Process name is required.")
      .max(120, "Process name cannot exceed 120 characters.")
      .transform((val) => normalizeProcessName(val))
      .refine(
        (val) => val.length > 4 && val.endsWith(".exe"),
        "A valid process name is required (e.g. whatsapp.exe).",
      ),
    displayName: z
      .string()
      .trim()
      .max(100, "Display name cannot exceed 100 characters.")
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
  })
  .strict();

export type AddExcludedApplicationInput = z.output<
  typeof addExcludedApplicationSchema
>;

export const updateExcludedApplicationSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(100, "Display name cannot exceed 100 characters.")
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
  })
  .strict();

export type UpdateExcludedApplicationInput = z.output<
  typeof updateExcludedApplicationSchema
>;
