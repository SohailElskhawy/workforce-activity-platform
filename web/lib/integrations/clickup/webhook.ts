import { createHmac, timingSafeEqual } from "node:crypto";

import { decryptJson } from "@/lib/crypto/secret";
import type { ClickUpClient } from "@/lib/integrations/clickup/client";
import {
  defaultClickUpDatabase,
  mapClickUpPriorityToWorkLens,
  mapClickUpStatusToWorkLens,
  type ClickUpSyncDatabase,
} from "@/lib/integrations/clickup/sync";
import type { Prisma } from "@/src/generated/prisma/client";

export type ClickUpWebhookPayload = {
  event:
    | "taskCreated"
    | "taskUpdated"
    | "taskDeleted"
    | "taskStatusUpdated"
    | string;
  task_id: string;
  webhook_id: string;
  history_items?: Array<{
    id: string;
    field: string;
    before?: unknown;
    after?: unknown;
  }>;
};

/**
 * Verifies the ClickUp webhook signature using HMAC-SHA256 with constant-time comparison.
 */
export function verifyClickUpWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const cleanSignature = signatureHeader.trim().toLowerCase();
  const computedHex = createHmac("sha256", secret.trim())
    .update(rawBody)
    .digest("hex");

  try {
    const signatureBuffer = Buffer.from(cleanSignature, "hex");
    const computedBuffer = Buffer.from(computedHex, "hex");

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, computedBuffer);
  } catch {
    return false;
  }
}

export type WebhookProcessResult = {
  success: boolean;
  action: "CREATED" | "UPDATED" | "DELETED" | "SKIPPED";
  taskId?: string;
  message?: string;
};

export async function processClickUpWebhook(
  companyId: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
  options: {
    client?: ClickUpClient;
    db?: ClickUpSyncDatabase;
  } = {}
): Promise<WebhookProcessResult> {
  const db = options.db ?? defaultClickUpDatabase;

  const integration = await db.findIntegration(companyId);
  if (!integration || !integration.encryptedCredentials) {
    return { success: false, action: "SKIPPED", message: "Integration not configured" };
  }

  const credentials = decryptJson<{ apiToken: string; webhookSecret?: string }>(
    integration.encryptedCredentials
  );

  const webhookSecret =
    credentials.webhookSecret ||
    ((integration.config as Record<string, unknown>)?.webhookSecret as string);

  if (webhookSecret) {
    const isValid = verifyClickUpWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret
    );
    if (!isValid) {
      throw new Error("Invalid ClickUp webhook signature");
    }
  }

  let payload: ClickUpWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Malformed webhook JSON body");
  }

  if (!payload.task_id || !payload.event) {
    return { success: false, action: "SKIPPED", message: "Missing task_id or event" };
  }

  // Handle task deletion
  if (payload.event === "taskDeleted") {
    const mapping = await db.findMapping(companyId, "TASK", payload.task_id);
    if (mapping) {
      await db.updateTask(mapping.internalId, {
        status: "CANCELLED",
      });
      return { success: true, action: "DELETED", taskId: mapping.internalId };
    }
    return { success: true, action: "SKIPPED", message: "Task not mapped" };
  }

  // For created / updated events, fetch fresh task data if client provided
  if (options.client) {
    try {
      const cuTask = await options.client.getTask(payload.task_id);
      const mapping = await db.findMapping(companyId, "TASK", cuTask.id);
      const status = mapClickUpStatusToWorkLens(cuTask.status?.status);
      const priority = mapClickUpPriorityToWorkLens(cuTask.priority?.priority);
      const dueDate = cuTask.due_date
        ? new Date(parseInt(cuTask.due_date, 10))
        : null;
      const estimatedMinutes = cuTask.time_estimate
        ? Math.round(cuTask.time_estimate / 60000)
        : null;

      if (mapping) {
        await db.updateTask(mapping.internalId, {
          title: cuTask.name,
          description: cuTask.description || cuTask.text_content || undefined,
          status,
          priority,
          dueDate,
          estimatedMinutes,
        });

        await db.upsertMapping(
          companyId,
          "TASK",
          cuTask.id,
          "Task",
          mapping.internalId,
          {
            lastSyncedAt: new Date().toISOString(),
            direction: "INBOUND",
            event: payload.event,
          } as Prisma.InputJsonValue
        );

        return { success: true, action: "UPDATED", taskId: mapping.internalId };
      } else {
        const systemUser = await db.getUserForSystem(companyId);
        let project = await db.findDefaultProject(companyId);
        if (!project) {
          project = await db.createDefaultProject(companyId, "ClickUp Tasks");
        }

        if (systemUser && project) {
          const created = await db.createTask({
            companyId,
            projectId: project.id,
            title: cuTask.name,
            description: cuTask.description || cuTask.text_content || undefined,
            status,
            priority,
            dueDate,
            estimatedMinutes,
            createdById: systemUser.id,
          });

          await db.upsertMapping(
            companyId,
            "TASK",
            cuTask.id,
            "Task",
            created.id,
            {
              lastSyncedAt: new Date().toISOString(),
              direction: "INBOUND",
              event: payload.event,
            } as Prisma.InputJsonValue
          );

          return { success: true, action: "CREATED", taskId: created.id };
        }
      }
    } catch (fetchErr) {
      return {
        success: false,
        action: "SKIPPED",
        message: `Failed to fetch ClickUp task: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
      };
    }
  }

  return { success: true, action: "SKIPPED", message: "Processed event metadata" };
}
