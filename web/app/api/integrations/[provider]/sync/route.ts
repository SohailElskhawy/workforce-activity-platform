import { requireManagerContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit/log";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { syncClickUpInbound } from "@/lib/integrations/clickup/sync";
import { importClockifyHistoricalTime } from "@/lib/integrations/clockify/import";
import { syncKolayIkInbound } from "@/lib/integrations/kolayik/sync";
import { prisma } from "@/lib/prisma";
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
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const { provider } = await params;
    const validatedProvider = integrationProviderSchema.parse(
      provider.toUpperCase()
    );

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
    } else if (validatedProvider === "KOLAY_IK") {
      await parseRequestBody(request, emptySchema);
      const result = await syncKolayIkInbound(context);
      syncSummary = result as unknown as Record<string, unknown>;
    }

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
    return handleRouteError(error);
  }
}
