import { z } from "zod";

const activityTypeSchema = z.enum([
  "APPLICATION",
  "IDLE",
  "COMPUTER_LOCK",
  "COMPUTER_UNLOCK",
  "SYSTEM_START",
  "SYSTEM_STOP",
]);

export const registerDeviceSchema = z
  .object({
    employeeId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
  })
  .strict();

export const heartbeatSchema = z
  .object({
    agentVersion: z.string().trim().min(1).max(64),
    timestamp: z.coerce.date(),
  })
  .strict();

export const agentActivitySchema = z
  .object({
    applicationName: z.string().max(160).nullable().optional(),
    endAt: z.coerce.date(),
    eventId: z.string().uuid(),
    fileName: z.string().max(500).nullable().optional(),
    processName: z.string().max(260).nullable().optional(),
    startAt: z.coerce.date(),
    type: activityTypeSchema,
    windowTitle: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const activityBatchSchema = z
  .object({ activities: z.array(agentActivitySchema).min(1).max(100) })
  .strict();

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type AgentActivityInput = z.infer<typeof agentActivitySchema>;
export type ActivityBatchInput = z.infer<typeof activityBatchSchema>;
