import { z } from "zod";

export const updateSystemSettingsSchema = z.object({
  notificationDueSoonHours: z
    .number()
    .int("Must be an integer")
    .min(1, "Must be at least 1 hour")
    .max(168, "Cannot exceed 168 hours (7 days)"),
  defaultIdleThresholdSeconds: z
    .number()
    .int("Must be an integer")
    .min(60, "Must be at least 60 seconds")
    .max(1800, "Cannot exceed 1800 seconds (30 minutes)"),
});

export type UpdateSystemSettingsInput = z.infer<typeof updateSystemSettingsSchema>;
