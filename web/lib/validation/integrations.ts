import { z } from "zod";

export const integrationProviderSchema = z.enum([
  "CLICKUP",
  "KOLAY_IK",
  "CLOCKIFY",
]);
export type IntegrationProviderType = z.infer<typeof integrationProviderSchema>;

export const integrationStatusSchema = z.enum([
  "NOT_CONFIGURED",
  "CONNECTED",
  "ERROR",
  "SYNCING",
  "DISABLED",
]);
export type IntegrationStatusType = z.infer<typeof integrationStatusSchema>;

export const clickUpConfigSchema = z.object({
  apiToken: z.string().trim().min(5, "ClickUp API token is required"),
  authType: z.enum(["PERSONAL_TOKEN", "OAUTH"]).default("PERSONAL_TOKEN"),
  webhookSecret: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  listId: z.string().trim().optional(),
  syncDirection: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]).default("INBOUND"),
});
export type ClickUpConfigInput = z.infer<typeof clickUpConfigSchema>;

export const clockifyConfigSchema = z.object({
  apiKey: z.string().trim().min(5, "Clockify API key is required"),
  workspaceId: z.string().trim().optional(),
});
export type ClockifyConfigInput = z.infer<typeof clockifyConfigSchema>;

export const kolayIkConfigSchema = z.object({
  apiToken: z.string().trim().min(5, "Kolay İK API token is required"),
  apiBaseUrl: z
    .string()
    .trim()
    .url("Invalid API URL")
    .optional()
    .refine((url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        // SSRF protection: only allow official Kolay IK domain
        return parsed.hostname.endsWith("kolayik.com") || parsed.hostname === "localhost";
      } catch {
        return false;
      }
    }, "API URL must be on the official kolayik.com domain"),
});
export type KolayIkConfigInput = z.infer<typeof kolayIkConfigSchema>;

export const clockifyImportSchema = z.object({
  workspaceId: z.string().trim().min(1, "Clockify workspace ID is required"),
  startDate: z.string().datetime({ message: "Valid ISO startDate is required" }),
  endDate: z.string().datetime({ message: "Valid ISO endDate is required" }),
});
export type ClockifyImportInput = z.infer<typeof clockifyImportSchema>;

export const clickUpSyncSchema = z.object({
  listId: z.string().trim().optional(),
  direction: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]).optional(),
});
export type ClickUpSyncInput = z.infer<typeof clickUpSyncSchema>;
