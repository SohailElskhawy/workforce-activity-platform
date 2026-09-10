import { requireManagerContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit/log";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { syncClickUpInbound } from "@/lib/integrations/clickup/sync";
import { importClockifyHistoricalTime } from "@/lib/integrations/clockify/import";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth-context";
import { recordIntegrationSyncStatusWithStore } from "@/lib/services/integrations";
import type { IntegrationProvider } from "@/src/generated/prisma/client";
import {
  clickUpSyncSchema,
  clockifyImportSchema,
  integrationProviderSchema,
} from "@/lib/validation/integrations";
import { z } from "zod";

const emptySchema = z.object({}).optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  let context: AuthContext | null = null;
  let validatedProvider: IntegrationProvider | null = null;
  try {
    assertSameOrigin(request);
    context = await requireManagerContext();
    const { provider } = await params;
    validatedProvider = integrationProviderSchema.parse(
      provider.toUpperCase()
    );

    if (validatedProvider === "KOLAY_IK") {
      await parseRequestBody(request, emptySchema);
      throw new ApiError(
        "CONFLICT",
        "Kolay İK synchronization is disabled. Manage HR data internally.",
        409,
      );
    }

    await writeAudit(prisma, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_SYNC_STARTED",
      entityType: "Integration",
      entityId: validatedProvider,
      metadata: {
        provider: validatedProvider,
      },
    });

    let syncSummary: Record<string, unknown> = {};

    if (validatedProvider === "CLICKUP") {
      const body = await parseRequestBody(request, clickUpSyncSchema.optional());
      const result = await syncClickUpInbound(context, {
        listId: body?.listId,
      });
      syncSummary = result as unknown as Record<string, unknown>;
    } else if (validatedProvider === "CLOCKIFY") {
      const body = await parseRequestBody(request, clockifyImportSchema);
      const result = await importClockifyHistoricalTime(context, {
        workspaceId: body.workspaceId,
        startDate: body.startDate,
        endDate: body.endDate,
      });
      syncSummary = result as unknown as Record<string, unknown>;
    }

    await recordIntegrationSyncStatusWithStore(
      context.companyId,
      validatedProvider,
      "CONNECTED",
      null
    );

    await writeAudit(prisma, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_SYNC_COMPLETED",
      entityType: "Integration",
      entityId: validatedProvider,
      metadata: {
        provider: validatedProvider,
        ...syncSummary,
      },
    });

    return ok(syncSummary);
  } catch (error) {
    if (context && validatedProvider) {
      const errorMessage =
        error instanceof Error ? error.message : "Integration sync failed";
      try {
        await recordIntegrationSyncStatusWithStore(
          context.companyId,
          validatedProvider,
          "ERROR",
          errorMessage
        );
        await writeAudit(prisma, {
          companyId: context.companyId,
          actorUserId: context.userId,
          action: "INTEGRATION_SYNC_FAILED",
          entityType: "Integration",
          entityId: validatedProvider,
          metadata: {
            provider: validatedProvider,
            error: errorMessage,
          },
        });
      } catch {
        // preserve original error
      }
    }
    return handleRouteError(error);
  }
}
